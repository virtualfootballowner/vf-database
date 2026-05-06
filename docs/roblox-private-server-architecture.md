# VF FACEIT — Private Server Architecture

How the bot, the website, and the Roblox game cooperate to spin up a
private (reserved) Roblox server every time a scrimmage goes live, and
how players land in the right server with the right permissions.

Companion to the API spec: [`docs/roblox-scrimmage-events.md`](./roblox-scrimmage-events.md).

---

## 1. Why this is hard

Roblox does **not** expose a public Open Cloud API for reserving game
servers. The only documented way to create a reserved (anonymous,
revocable) private server is from inside a running Roblox server with:

```lua
local code, privateServerId = TeleportService:ReserveServer(placeId)
```

That call returns an **access code** that you then hand to
`TeleportService:TeleportToPrivateServer` to actually move players into
that server.

Our backend (Vercel + a Discord bot on Railway) cannot make that call
itself — it has no way to talk to Roblox inbound. So we need a Roblox
server somewhere that does it for us.

We considered three options before settling on the design below.

### Options considered

| Option                                       | Why it loses                                                                                                                                            |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Open Cloud `ReserveServer` REST**          | Doesn't exist as of 2026-05. Roblox has Open Cloud for datastores, messaging, place-management — not server reservation.                                |
| **MessagingService push** (web → lobby)      | Open Cloud's MessagingService publish API works, but the lobby still has to subscribe + reserve + reply. Adds plumbing without removing the Roblox-side state machine. |
| **Polling matchmaker place** (web ↔ lobby)   | Workable but introduces a 5–10s reservation latency and another service to monitor.                                                                     |
| **Pre-generated server pool**                | Wastes reserved instances on cancelled lobbies and complicates pool refill.                                                                             |
| **✅ On-demand reservation in the lobby place** | What we picked. Zero polling, zero pre-generation, zero extra Roblox infrastructure.                                                                    |

---

## 2. The chosen architecture

```
┌──────────────┐                                  ┌──────────────────┐
│  Discord bot │ /scrimmage start → … → goLive()  │  Web Backend     │
│   (Railway)  │ ───────────────────────────────► │  (Vercel)        │
│              │   updateScrimmageMatchStatus     │                  │
│              │     status='live'                │  scrimmage_matches│
│              │     roblox_join_link=<deep link> │  reserved_server  │
│              │ ◄── edit lobby card ─────        │   _code (null)    │
│              │     "🎮 Click to join: <link>"   │                  │
└──────┬───────┘                                  └────────┬─────────┘
       │                                                   │
       │   players click the link                          │
       ▼                                                   │
┌──────────────────────────────────────┐                   │
│  VF Lobby Place (Roblox)             │                   │
│  - reads LaunchData = match_code     │                   │
│  - GET verify-player ────────────────────────────────────┤
│  - on first joiner:                  │                   │
│      ReserveServer(MAIN_PLACE_ID)    │                   │
│      POST server-info ───────────────────────────────────┤
│  - TeleportToPrivateServer(main, code, players, …)       │
└────────┬─────────────────────────────┘                   │
         │                                                 │
         ▼                                                 │
┌──────────────────────────────────────┐                   │
│  VF Main Game Place (reserved)       │                   │
│  - GET verify-player on join         │                   │
│  - if !authorized → kick             │                   │
│  - if role=captain → grant admin     │                   │
│  - assign team based on `team` field │                   │
│  - host runs :start match SCR-####   │                   │
│      POST /events (match_start) ─────────────────────────┤
│  - goals/cards/MOTM as they happen   │                   │
│      POST /events (goal, …) ─────────────────────────────┤
│  - host runs :fulltime               │                   │
│      POST /events (match_end) ───────────────────────────► auto-finalize
│                                                            apply ELO
│                                                            edit Discord card
└──────────────────────────────────────┘                   │
```

The bot **never waits** for the lobby to mint a server. It posts the
join link the instant the ready check passes. The reservation happens
later, on first-join, transparently.

---

## 3. Bot side (already implemented)

When the ready check passes (`src/bot/scrimmage/ready.ts → goLive`):

1. Compute `roblox_join_link`:
   ```ts
   const lobbyPlaceId = env.VF_ROBLOX_LOBBY_PLACE_ID;
   const link = `https://www.roblox.com/games/start?placeId=${lobbyPlaceId}&launchData=${matchCode}`;
   ```
   - If `VF_ROBLOX_LOBBY_PLACE_ID` is unset, the link is `null` and the
     embed falls back to "join manually with match code".
2. `updateScrimmageMatchStatus(..., 'live', { match_started_at, roblox_join_link })`.
3. Edit the existing lobby card to show:
   ```
   🟢 VF FACEIT · LIVE · SCR-2026-0042
   🎮 Click to join: <link>
   🔑 Match code: SCR-2026-0042

   Captains <a> and <b> are granted in-game moderator automatically.
   Run :fulltime in Roblox to end the match — final score, scorers and
   ELO updates post here automatically.
   ```

That's it. The bot has zero further responsibilities until the API
posts back the result embed (which it does over Discord REST from the
auto-finalizer, see `src/lib/scrimmage/auto-finalize.ts`).

---

## 4. Lobby place — the Roblox-side contract

The Roblox dev creates a small **lobby place** in the same Roblox
"game" (universe) as the main football place. It's only job is to
greet incoming players, verify them, and teleport them into the
reserved match server.

Pseudo-Lua (real implementation will use your existing HMAC + HTTP
helpers):

```lua
local Players          = game:GetService("Players")
local TeleportService  = game:GetService("TeleportService")

local MAIN_PLACE_ID = 1234567890   -- the main football place
local API           = "https://myvirtualfootball.com"

local pendingTeleports = {}        -- userId → matchCode

Players.PlayerAdded:Connect(function(player)
    local launchData = player:GetJoinData().LaunchData or ""
    local matchCode  = launchData:match("(SCR%-%d+%-%d+)")
    if not matchCode then
        player:Kick("Open this server from the Discord scrimmage link.")
        return
    end

    -- 1) Auth check
    local res = httpGet(API.."/api/scrimmage/verify-player",
                        { match_code = matchCode,
                          roblox_user_id = tostring(player.UserId) })
    if not res.authorized then
        player:Kick("You're not on the roster for "..matchCode..".")
        return
    end

    -- 2) Need a reserved server?
    local code = res.reserved_server_code
    if not code then
        local newCode, privateServerId = TeleportService:ReserveServer(MAIN_PLACE_ID)
        local r = httpPost(API.."/api/scrimmage/server-info", {
            match_code             = matchCode,
            reserved_server_code   = newCode,
            private_server_id      = privateServerId,
            roblox_place_id        = tostring(MAIN_PLACE_ID),
        })
        if r.already_reserved then
            -- Race lost — use the existing one
            code = r.reserved_server_code
        else
            code = newCode
        end
    end

    -- 3) Teleport with team + role baked into teleportData
    local teleportData = {
        match_code = matchCode,
        team       = res.team,
        role       = res.role,
    }
    TeleportService:TeleportToPrivateServer(
        MAIN_PLACE_ID,
        code,
        { player },
        nil,           -- spawnName
        teleportData
    )
end)
```

Key rules:

- **Always GET verify-player on join.** Don't trust LaunchData alone —
  it's not signed.
- **Idempotency on reservation.** If the lobby is busy and two
  players hit `ReserveServer` concurrently, the second one's
  `/server-info` POST will get a 409 with the existing code; just use
  that.
- **Pass team + role via teleportData.** The main place reads it in
  `Player:GetJoinData().TeleportData` to skip a second verify-player
  call (or call it again for safety — both are fine).

---

## 5. Main game place — the Roblox-side contract

The main football place needs a small auth shim on player join:

```lua
Players.PlayerAdded:Connect(function(player)
    local td = player:GetJoinData().TeleportData
    if not td or not td.match_code then
        player:Kick("Join via the Discord scrimmage link.")
        return
    end

    local res = httpGet(API.."/api/scrimmage/verify-player",
                        { match_code     = td.match_code,
                          roblox_user_id = tostring(player.UserId) })

    if not res.authorized or res.status == "completed" or res.status == "voided" then
        player:Kick("You're not authorized for this match.")
        return
    end

    -- Auto-assign team
    assignToTeam(player, res.team)             -- 1 or 2

    -- Auto-grant captain admin
    if res.role == "captain" then
        grantAdminCommands(player)             -- :fulltime, :kick, :scoreboard, …
    end
end)
```

The main place is also where:

- Host's `:start match SCR-####-####` chat command POSTs `match_start`.
- Goal / card / MOTM etc. events POST to `/api/scrimmage/events`.
- Host's `:fulltime` command POSTs `match_end` — auto-finalize fires.

---

## 6. Failure modes & fallbacks

| Failure                                  | What happens                                                                                           |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `VF_ROBLOX_LOBBY_PLACE_ID` unset         | Bot posts the live embed without a join link; embed reads "no lobby placeId configured".               |
| Lobby `ReserveServer` errors             | Lobby place kicks the joiner with a friendly message; player retries with the same link a few seconds later. |
| Lobby crashes mid-match                  | Reserved server keeps running. Next joiner re-fetches the cached code from verify-player and teleports straight in. |
| Roblox events pipeline is broken         | Match stays `live` indefinitely. Admin uses `/scrimmage void` to free the queue (no ELO applied).      |
| `match_end` never fires                  | Same as above — admin voids it.                                                                        |
| Two `match_end` events for same match    | Second is rejected: `Match SCR-#### is completed; cannot accept new events.` Auto-finalize is idempotent. |

---

## 7. Why we did NOT pre-generate a server pool

Tempting alternative: have a background Roblox process keep the table
`scrimmage_server_pool` topped up with N reserved codes, then claim one
when a scrimmage goes live. Reasons it lost:

- **Wasted reservations.** Every cancelled lobby orphans a code.
- **Expiry handling.** Reserved codes don't expire automatically, but
  Roblox doesn't promise they live forever either. Pool freshness is a
  real concern.
- **Refill is itself a Roblox service.** Doesn't actually remove the
  "we need a Roblox process running" requirement, just shifts when it
  runs.
- **Latency win is illusory.** First-join reservation takes ~200ms in
  practice. We don't gain noticeably by pre-generating.

If we ever observe reservation flakiness in production, falling back
to a small pool (size 5-10) is a one-table migration — schema-compatible
with the current design.

---

## 8. Env vars reference

| Var                              | Where  | Purpose                                                         |
| -------------------------------- | ------ | --------------------------------------------------------------- |
| `VF_ROBLOX_LOBBY_PLACE_ID`       | bot    | Roblox `placeId` of the lobby place. Used to build the join link. |
| `VF_SCRIMMAGE_INGEST_SECRET`     | web    | Shared HMAC secret for `/events`, `/verify-player`, `/server-info`. |
| `DISCORD_BOT_TOKEN`              | both   | Web side uses it to PATCH the lobby card after auto-finalize.   |
| `DISCORD_SCRIMMAGE_LOBBY_CHANNEL_ID` | bot | Where every `/scrimmage start` lobby card lands.                |

The Roblox dev needs **`VF_SCRIMMAGE_INGEST_SECRET`** and the API base
URL. They never need the Discord bot token or any DB credentials.
