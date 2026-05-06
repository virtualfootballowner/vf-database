# VF FACEIT — Roblox Integration Spec

This is the **single source of truth** for the Roblox dev wiring up the VF
FACEIT scrimmage system. Three endpoints, one HMAC scheme, fully
automated end-to-end:

| Endpoint                                | Method | Purpose                                                  |
| --------------------------------------- | ------ | -------------------------------------------------------- |
| `/api/scrimmage/events`                 | POST   | Push live match events (goals, assists, cards, MOTM…).   |
| `/api/scrimmage/verify-player`          | GET    | On player join: is this Roblox user authorized + role + team + reserved server code? |
| `/api/scrimmage/server-info`            | POST   | Lobby place reports the reserved-server access code back so future joiners reuse it. |

Companion architecture doc: [`docs/roblox-private-server-architecture.md`](./roblox-private-server-architecture.md).

There is **no SDK to install** and **no schema to maintain on your side** —
just signed JSON HTTP calls.

---

## 1. End-to-end flow

```
 Discord                   Web Backend                 Roblox
 -------                   -----------                 ------
 /scrimmage start
   queue → draft → ready
   ready check passes
                           status='live'
                           writes roblox_join_link
   bot edits lobby card:
     "🟢 LIVE · SCR-…
      🎮 Click to join: <link>
      🔑 Match code: SCR-…"

   players click link  ─────────────────────────────►  VF Lobby place opens
                                                       (LaunchData = match_code)
                       ◄── GET verify-player ──────────  reads LaunchData,
                       returns { authorized,             checks every joiner
                                 role, team,
                                 reserved_server_code }
                                                       if reserved_server_code is null:
                                                          first joiner
                                                          → ReserveServer(MAIN_PLACE_ID)
                                                          → POST /server-info
                       ◄── POST server-info ──────────
                       caches reserved_server_code
                                                          → TeleportToPrivateServer
                                                       else:
                                                          → TeleportToPrivateServer
                                                          (subsequent joiners)

                                                       Players spawn in
                                                       reserved server → game
                                                       checks verify-player
                                                       again → assigns team /
                                                       grants captain admin

                                                       Host types  :start match
                       ◄── POST /events ──────────────
                       (match_start)                   Throughout the game,
                       writes roblox_started_at,        every goal / card /
                       place_id, job_id                 MOTM POSTed to /events

                                                       Host types  :fulltime
                       ◄── POST /events ──────────────
                       (match_end)
                       counts goals from events,
                       applies ELO,
                       edits lobby card to a
                       result embed automatically
```

The **only manual steps** that remain are:

- `/scrimmage start` (host opens the lobby)
- Pick / Ready (players)
- `:start match SCR-####-####` (host in Roblox chat)
- `:fulltime` (host in Roblox chat)

Everything else is auto.

---

## 2. Authentication (all three endpoints)

All requests are signed with the `VF_SCRIMMAGE_INGEST_SECRET` shared
secret. We give you the production value privately. **Never put it in
client-side code.** All requests must come from the Roblox game server,
not from the player's client.

| Header              | Required | Notes                                                                |
| ------------------- | -------- | -------------------------------------------------------------------- |
| `x-vf-timestamp`    | yes      | Unix seconds (string).                                               |
| `x-vf-signature`    | yes      | `hex(HMAC_SHA256(SECRET, ts + "." + payload))`                       |
| `content-type`      | POSTs    | `application/json`                                                   |

**`payload`** is method-dependent:

- For **POST**: the **raw JSON body** verbatim (no whitespace tweaking
  between sign + send).
- For **GET**: the literal string `"GET\n" + path + querystring`, e.g.
  `"GET\n/api/scrimmage/verify-player?match_code=SCR-2026-0042&roblox_user_id=12345678"`.

Reject rules (all endpoints):

- Timestamp older than **5 minutes** or > 60s in the future → `401`
- Bad signature → `401`

Roblox doesn't ship a stdlib HMAC-SHA256 — use any of the well-known
community modules (e.g. `HashLib` on the toolbox) or run a tiny
Cloudflare Worker that proxies + signs if you'd rather keep the secret
off the Roblox server.

---

## 3. `POST /api/scrimmage/events`

### Body

A single POST may carry **1..50 events** (batch every ~2s in normal play
to keep request volume sane):

```json
{
  "events": [
    {
      "external_event_id": "abc-123",
      "type": "goal",
      "match_code": "SCR-2026-0003",
      "roblox_user_id": "12345678",
      "minute": 23,
      "details": {
        "assist_roblox_user_id": "87654321",
        "assist_roblox_username": "WozyPrime",
        "shot": "long_range"
      },
      "occurred_at": "2026-05-06T01:23:45Z"
    }
  ]
}
```

### Field reference

| Field              | Type            | Required | Notes                                                                                                                          |
| ------------------ | --------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `external_event_id`| string          | strongly recommended | Unique per event. Used for idempotent retries — POST the same id twice → 2nd is a no-op.                           |
| `type`             | string          | yes      | One of the canonical types below, or any custom string.                                                                        |
| `match_code`       | string          | yes      | The `SCR-YYYY-####` code from the Discord lobby card.                                                                          |
| `roblox_user_id`   | string \| number| yes      | The actor (scorer, fouler, …). Numbers are normalized to strings.                                                              |
| `minute`           | int             | optional | In-game minute. Omit for `match_start` / `match_end`.                                                                          |
| `details`          | object          | optional | Free-form JSON. Stored as-is.                                                                                                  |
| `occurred_at`      | ISO 8601 string | optional | Roblox-side wall clock for the event. Defaults to server-receive time if omitted.                                              |

### Canonical event types

| `type`         | Side-effect                                                                                                              |
| -------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `match_start`  | **Required.** Bumps status → `live` if not already. Sets `roblox_started_at`, `roblox_place_id`, `roblox_job_id`.        |
| `kickoff`      | Optional. Mark the start of each half.                                                                                   |
| `halftime`     | Optional.                                                                                                                |
| `fulltime`     | **Triggers auto-finalization** (alias for `match_end`).                                                                  |
| `match_end`    | **Triggers auto-finalization.** Sets `roblox_ended_at`. Send **once** per match. The API counts goals → applies ELO → edits the Discord card to a result embed automatically. No captain confirmation needed. |
| `goal`         | Counted toward the actor's team for the auto-finalize tally.                                                             |
| `own_goal`     | Counted toward the **opposite** team.                                                                                    |
| `assist`       | Optional standalone — most assists ride on `goal.details.assist_roblox_user_id` instead.                                 |
| `yellow_card`  |                                                                                                                          |
| `red_card`     |                                                                                                                          |
| `motm`         | Send at full-time.                                                                                                       |
| `save`         | Optional GK metric.                                                                                                      |
| `sub_in`       | Optional. Pair with `sub_out`.                                                                                           |
| `sub_out`      | Optional.                                                                                                                |
| `other`        | Anything else — `event_type` is free-text.                                                                               |

### Linking a Roblox session to a SCR code

We deliberately make the host do this manually so there is zero ambiguity:

1. Discord bot drops the `🟢 LIVE · SCR-2026-0003` card with the join link.
2. The host opens the Roblox match.
3. The host types `:start match SCR-2026-0003`.
4. Your Roblox code parses that, captures the token, then POSTs the
   `match_start` event:

```json
{
  "events": [
    {
      "external_event_id": "ms-<jobId>",
      "type": "match_start",
      "match_code": "SCR-2026-0003",
      "roblox_user_id": "<host roblox userId>",
      "details": {
        "roblox_place_id": "<game.PlaceId>",
        "roblox_job_id":   "<game.JobId>"
      },
      "occurred_at": "2026-05-06T01:20:00Z"
    }
  ]
}
```

### Auto-finalization on `match_end`

When the host runs `:fulltime`, fire one `match_end` event:

```json
{
  "events": [
    {
      "external_event_id": "me-<jobId>",
      "type": "match_end",
      "match_code": "SCR-2026-0003",
      "roblox_user_id": "<host roblox userId>",
      "occurred_at": "2026-05-06T02:05:00Z"
    }
  ]
}
```

The API will:

1. Insert the event into `scrimmage_match_events`.
2. Tally every previously-inserted `goal` / `own_goal` for this
   `match_code` to compute the final score.
3. Call `applyScrimmageResult` — writes scores, per-player ELO deltas,
   and flips `scrimmage_matches.status = 'completed'`.
4. Edit the original Discord lobby card to a "🏁 Result" embed
   showing final score, scorer lines, ELO Δ for each side, full
   rosters, and a footer note `Auto-finalized from Roblox match_end.`

Send `match_end` **once**. Subsequent `match_end` events for an
already-completed match are silently no-op'd (status check inside
`autoFinalizeScrimmage`).

If you also want to send a `fulltime` whistle event for the timeline
distinct from the actual match-end commit, send `fulltime` first
(triggers auto-finalize) and then any cleanup events ride along. The
two types are aliased server-side.

### Response

```json
{
  "received": 3,
  "processed": 3,
  "results": [
    {
      "external_event_id": "abc-123",
      "status": "inserted",
      "event_id":  "9b8a8b66-...",
      "match_id":  "ab97cf04-...",
      "player_resolved": true
    },
    {
      "external_event_id": "abc-124",
      "status": "duplicate",
      "match_id": "ab97cf04-...",
      "player_resolved": true
    },
    {
      "external_event_id": "abc-125",
      "status": "rejected",
      "reason":  "Unknown match_code: SCR-2026-9999"
    }
  ],
  "finalized": [
    {
      "match_code": "SCR-2026-0003",
      "ok": true,
      "team1Score": 4,
      "team2Score": 2,
      "team1Delta": 18,
      "team2Delta": -18,
      "players_updated": 16,
      "discord_card_edited": true
    }
  ]
}
```

`finalized` is only present when the batch contained at least one
`match_end` / `fulltime`. Multiple finalizes per batch are possible if
you bundle two match-end whistles (don't do that, but it's safe).

Per-event `status`:

- `inserted` — event landed; `event_id` is the row UUID.
- `duplicate` — same `(match_id, external_event_id)` already existed; we
  treat your retry as a no-op. **This is the success case for retries.**
- `rejected` — see `reason`. Common reasons:
  - `Missing required field (match_code | type | roblox_user_id).`
  - `Unknown match_code: <code>`
  - `Match <code> is completed; cannot accept new events.`

---

## 4. `GET /api/scrimmage/verify-player`

Called by Roblox when a player joins **either**:

- the **VF lobby place** (your code reads `Player:GetJoinData().LaunchData`
  to pull the `match_code`), **or**
- the **reserved match server** (your code knows the match_code from the
  lobby teleport's `teleportData`).

### Query string

```
?match_code=SCR-2026-0042&roblox_user_id=12345678
```

### Signing

`payload = "GET\n/api/scrimmage/verify-player?match_code=SCR-2026-0042&roblox_user_id=12345678"`

```lua
local path = "/api/scrimmage/verify-player?match_code=" .. matchCode
          .. "&roblox_user_id=" .. tostring(robloxUserId)
local ts   = tostring(os.time())
local sig  = hmacSha256Hex(SECRET, ts .. ".GET\n" .. path)
```

### Response — authorized

```json
{
  "authorized": true,
  "role": "captain",
  "team": 1,
  "match_code": "SCR-2026-0042",
  "match_id": "ab97cf04-...",
  "status": "live",
  "reserved_server_code": "abcdef0123...",
  "private_server_id": "uuid",
  "main_place_id": "12345"
}
```

### Response — not authorized

```json
{
  "authorized": false,
  "reason": "Player is not on the roster for this match.",
  "match_code": "SCR-2026-0042",
  "match_id": "ab97cf04-...",
  "status": "live"
}
```

What you do with the response:

- `authorized = false` → **kick** the player ("This is a private match
  for the rostered scrimmage participants only").
- `role = "captain"` → grant your in-game admin command set (scoreboard
  controls, `:fulltime`, etc.).
- `team = 1 | 2` → spawn them on the correct side.
- `reserved_server_code = "..."` (only meaningful in the lobby place) →
  use it as the access code in
  `TeleportService:TeleportToPrivateServer(main_place_id, reserved_server_code, …)`.
- `reserved_server_code = null` (lobby, first joiner) → call
  `TeleportService:ReserveServer(main_place_id)` yourself, then POST
  `/server-info` to register the new code.

---

## 5. `POST /api/scrimmage/server-info`

Called by the lobby place after it generates a reserved server with
`TeleportService:ReserveServer`. Idempotent — if a code is already
registered for this match, the response will tell you to use the
existing one instead.

### Body

```json
{
  "match_code": "SCR-2026-0042",
  "reserved_server_code": "abcdef0123...",
  "private_server_id": "uuid",
  "roblox_place_id": "12345",
  "roblox_job_id": "67890"
}
```

| Field                  | Required | Notes                                                |
| ---------------------- | -------- | ---------------------------------------------------- |
| `match_code`           | yes      | The SCR code.                                        |
| `reserved_server_code` | yes      | The access-code string from `ReserveServer`.         |
| `private_server_id`    | optional | Roblox `privateServerId` (informational).            |
| `roblox_place_id`      | optional | The main game place ID.                              |
| `roblox_job_id`        | optional | The reserved server's `jobId` once it's running.     |

### Response — accepted

```json
{
  "ok": true,
  "match_code": "SCR-2026-0042",
  "match_id": "ab97cf04-...",
  "reserved_server_code": "abcdef0123..."
}
```

### Response — already reserved (HTTP 409)

```json
{
  "ok": false,
  "already_reserved": true,
  "reserved_server_code": "DIFFERENT-EXISTING-CODE",
  "private_server_id": "...",
  "message": "Match already has a reserved server; reuse this one."
}
```

When you see 409, **do not create a fresh reservation** — teleport the
player to the existing `reserved_server_code` instead. This protects
against split-brain when two lobby servers race on the very first
joiner.

---

## 6. Idempotency & retries (events endpoint)

- The server enforces a unique constraint on
  `(match_id, external_event_id)`. Always pass `external_event_id`.
- Retry up to 3 times on network errors with exponential backoff (1s,
  2s, 4s). The 2nd+ attempt will return `status: "duplicate"`, not a
  duplicate insert.
- Without an `external_event_id`, you can still POST, but you lose
  retry safety.
- `match_end` is also idempotent — the auto-finalizer short-circuits
  if `scrimmage_matches.status` is already `completed`.

---

## 7. Local dev / testing

Stand up a `localhost:3000` next.js dev server, set
`VF_SCRIMMAGE_INGEST_SECRET=test` in `.env.local`, then `curl`:

```bash
TS=$(date +%s)
SECRET="test"
BODY='{"events":[{"external_event_id":"t1","type":"match_start","match_code":"SCR-2026-0003","roblox_user_id":"12345678"}]}'
SIG=$(printf '%s' "${TS}.${BODY}" | openssl dgst -sha256 -hmac "$SECRET" -hex | awk '{print $2}')

curl -i -X POST http://localhost:3000/api/scrimmage/events \
  -H "content-type: application/json" \
  -H "x-vf-timestamp: $TS" \
  -H "x-vf-signature: $SIG" \
  --data-binary "$BODY"
```

Expected: `200 OK` with `results[0].status === "inserted"`. Re-run the
same command to confirm `status: "duplicate"`.

For verify-player:

```bash
PATH_QS="/api/scrimmage/verify-player?match_code=SCR-2026-0003&roblox_user_id=12345678"
TS=$(date +%s)
SIG=$(printf '%s' "${TS}.GET\n${PATH_QS}" | openssl dgst -sha256 -hmac "$SECRET" -hex | awk '{print $2}')
curl -i "http://localhost:3000${PATH_QS}" \
  -H "x-vf-timestamp: $TS" \
  -H "x-vf-signature: $SIG"
```

---

## 8. What the website does with each event

- **All event types** → row in `scrimmage_match_events`, surfaced on
  `/stats/faceit/SCR-####-####` "Event timeline" panel within ~1s.
- **`goal` / `own_goal`** → live score in the timeline header (T1 / T2)
  AND counted at finalize.
- **`match_start`** → green "Roblox" chip on the recents row at
  `/stats/faceit`, sets `roblox_started_at` + place/job ids.
- **`match_end` / `fulltime`** → sets `roblox_ended_at`, runs the
  auto-finalizer (count goals → apply ELO → edit Discord card →
  status='completed').

---

## 9. Open questions for the Roblox dev

When you have a moment, please confirm with VF staff:

1. Will the lobby be a separate Roblox **place** in the same game
   universe, or just a special spawn area in the main game place?
   (Affects which placeId we put in `VF_ROBLOX_LOBBY_PLACE_ID`.)
2. Will events ride a single shared HMAC, or one per Roblox `placeId`?
3. Do you want a "dry-run" header (`x-vf-dryrun: 1`) so test sessions
   never write to the live DB?
4. Is there a per-event ack you'd like surfaced in your Roblox console?
