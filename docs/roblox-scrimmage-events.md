# VF FACEIT — Roblox Event Ingestion Spec

Hand this document to your Roblox developer. It describes the **one HTTP
endpoint** they need to call to push live match events (goals, assists,
cards, MOTM, etc.) from the in-game Roblox server up to the VF web
backend, where it lights up the live event timeline at
`/stats/faceit/SCR-XXXX-####`.

There is **no SDK to install** and **no schema for them to maintain** —
just a signed JSON `POST` per batch of events.

---

## 1. The flow at a glance

```
 Discord                        Roblox Server                Web Backend
 -------                        -------------                -----------
 /scrimmage start
   → queue → draft → ready
 status = 'live' in DB
 (lobby card shows
  "VF FACEIT · LIVE · SCR-2026-0003")

                                Host types in Roblox chat:
                                  :start match SCR-2026-0003
                                Roblox parses ↑, then POSTs:
                                  { type: "match_start",
                                    match_code: "SCR-2026-0003",
                                    ... }                  ──>  events table
                                                                + scrimmage_matches
                                                                  marked linked

                                Throughout the game, every
                                kick / goal / card / MOTM
                                fires a POST:
                                  { type: "goal",
                                    match_code: "SCR-2026-0003",
                                    roblox_user_id: "12345678",
                                    minute: 23, ... }      ──>  events table
                                                                (timeline shows
                                                                 it within ~1s)

                                Final whistle:
                                  { type: "match_end" }   ──>  scrimmage_matches
                                                                .roblox_ended_at = now

 Captain runs /scrimmage report
 (or auto-finalize if you wire
  goal counts from events later)
```

The Roblox dev only needs to implement **one POST helper** and call it
from each in-game event hook. The web backend handles HMAC verification,
match lookup, player resolution, idempotency, and the live UI.

---

## 2. Endpoint

```
POST  https://myvirtualfootball.com/api/scrimmage/events
```

(Same path on dev: `http://localhost:3000/api/scrimmage/events`.)

### Headers

| Header              | Required | Notes                                             |
| ------------------- | -------- | ------------------------------------------------- |
| `content-type`      | yes      | `application/json`                                |
| `x-vf-timestamp`    | yes      | Unix seconds (string).                            |
| `x-vf-signature`    | yes      | `hex(HMAC_SHA256(secret, ts + "." + rawBody))`    |

The shared secret lives in the `VF_SCRIMMAGE_INGEST_SECRET` env var on the
server. We will give you the production value privately. **Never put it
in client-side code.** All requests must come from the Roblox game
server, not from the player's client.

### Reject rules

- Timestamp older than **5 minutes** or > 60s in the future → `401`
- Bad signature → `401`
- Body is not `{ events: [...] }` → `400`
- Batch larger than **50 events** → `413`

---

## 3. Request body

A single POST may carry **1..50 events** (you should batch every
~2 seconds in normal play to keep request volume sane):

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
        "shot": "long_range",
        "x": 32.4,
        "y": 18.1
      },
      "occurred_at": "2026-05-06T01:23:45Z"
    }
  ]
}
```

### Field reference

| Field              | Type            | Required | Notes                                                                                                                              |
| ------------------ | --------------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `external_event_id`| string          | strongly recommended | Unique per event in your Roblox state. Used for idempotent retries — if you POST the same id twice, the 2nd is a no-op. |
| `type`             | string          | yes      | One of the canonical types below, or any custom string you want.                                                                   |
| `match_code`       | string          | yes      | The `SCR-YYYY-####` code from the Discord lobby card.                                                                              |
| `roblox_user_id`   | string \| number| yes      | The actor (scorer, fouler, etc.). We normalize numbers to strings.                                                                 |
| `minute`           | int             | optional | In-game minute (1..120 typical). Omit for `match_start` / `match_end`.                                                             |
| `details`          | object          | optional | Free-form JSON. Stored as-is in `scrimmage_match_events.details` jsonb.                                                            |
| `occurred_at`      | ISO 8601 string | optional | Roblox-side wall clock for the event. Defaults to server-receive time if omitted.                                                  |

### Canonical event types

The website renders these with bespoke icons / colors. Anything else is
accepted but rendered with a generic style.

| `type`         | Renders as                | Notes                                                       |
| -------------- | ------------------------- | ----------------------------------------------------------- |
| `match_start`  | ▶ MATCH START             | **Required** — links the Roblox session to the SCR match. Pass `details.roblox_place_id` and `details.roblox_job_id` when you can. Bumps `status` to `live` if it isn't already. |
| `kickoff`      | ▶ KICKOFF                 | Optional. Mark the start of each half.                      |
| `halftime`     | ⚑ HALF-TIME               | Optional.                                                   |
| `fulltime`     | ⚑ FULL-TIME               | Optional. Whistle blew, but match data not wrapped yet.     |
| `match_end`    | 🏆 MATCH END              | Final state. Sets `roblox_ended_at`. Send **once** per match. |
| `goal`         | ● GOAL                    | Increments the team score on the live UI.                   |
| `own_goal`     | ● OWN GOAL                | Counted toward the **opposite** team on the live UI.        |
| `assist`       | ✋ ASSIST                 | Optional standalone — most assists ride on `goal.details.assist_roblox_user_id` instead. |
| `yellow_card`  | ◼ YELLOW                  |                                                             |
| `red_card`     | ◼ RED                     |                                                             |
| `motm`         | ★ MOTM                    | Send at full-time.                                          |
| `save`         | ✋ SAVE                   | Optional GK metric.                                         |
| `sub_in`       | ↑ SUB IN                  | Optional. Pair with `sub_out`.                              |
| `sub_out`      | ↓ SUB OUT                 | Optional.                                                   |
| `other`        | ⚔ (custom)                | Anything else — `event_type` is free-text.                  |

---

## 4. Signing the request (HMAC-SHA256)

Pseudocode (Lua-ish):

```lua
local HttpService = game:GetService("HttpService")

local SECRET = "<get-from-vf-staff>"   -- VF_SCRIMMAGE_INGEST_SECRET

local function postEvents(events)
  local body = HttpService:JSONEncode({ events = events })
  local ts   = tostring(os.time())
  local sig  = hmacSha256Hex(SECRET, ts .. "." .. body) -- your impl

  return HttpService:RequestAsync({
    Url     = "https://myvirtualfootball.com/api/scrimmage/events",
    Method  = "POST",
    Headers = {
      ["Content-Type"]    = "application/json",
      ["x-vf-timestamp"]  = ts,
      ["x-vf-signature"]  = sig,
    },
    Body = body,
  })
end
```

Roblox doesn't ship a stdlib HMAC-SHA256 — use any of the well-known
community modules (e.g. `HashLib` on the toolbox) or run a tiny Cloudflare
Worker that proxies + signs if you'd rather keep the secret off the
Roblox server.

---

## 5. Linking a Roblox match to a SCR code

We deliberately make the **host** do this manually so there is zero
ambiguity about which Discord lobby corresponds to a Roblox round:

1. Discord bot drops the `VF FACEIT · LIVE · SCR-2026-0003` card.
2. The host opens the Roblox match.
3. The host types a chat command, e.g. `:start match SCR-2026-0003`.
4. Your Roblox code parses the prefix `:start match `, captures the
   `SCR-####-####` token, then POSTs:

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

From that moment on:

- The match card on the website shows a green `Roblox` chip.
- All subsequent events for that `match_code` are accepted.
- The Roblox `placeId` / `jobId` are stored on `scrimmage_matches` for audit.

If the host **never** runs `:start match`, you can still POST events —
they'll just sit untimelined until someone reconciles them. Reject any
events for a `match_code` that hasn't reached `live` (the bot promotes the
status when ready-check passes).

---

## 6. Response

```json
{
  "received": 3,
  "processed": 2,
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
  ]
}
```

Per-event `status`:

- `inserted` — event landed; `event_id` is the row UUID.
- `duplicate` — same `(match_id, external_event_id)` already existed; we
  treat your retry as a no-op. **This is the success case for retries.**
- `rejected` — see `reason`. Common reasons:
  - `Missing required field (match_code | type | roblox_user_id).`
  - `Unknown match_code: <code>`
  - `Match <code> is completed; cannot accept new events.`
  - `DB error: <message>`

The HTTP status itself is `200` whenever the request was authenticated
and the body parsed — per-event errors are inside `results`. Treat any
`results[i].status === "rejected"` as a logged-but-non-fatal client bug.

---

## 7. Idempotency & retries

- The server enforces a unique constraint on
  `(match_id, external_event_id)`. Always pass `external_event_id`.
- Retry up to 3 times on network errors with exponential backoff (1s,
  2s, 4s). The 2nd+ attempt will return `status: "duplicate"`, not a
  duplicate insert.
- Without an `external_event_id`, you can still POST, but you lose
  retry safety.

---

## 8. Local dev / testing

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

---

## 9. What the website does with each event

- **All event types** → row in `scrimmage_match_events`, surfaced on
  `/stats/faceit/SCR-####-####` "Event timeline" panel within ~1s.
- **`goal` / `own_goal`** → live score in the timeline header (T1 / T2).
- **`match_start`** → green "Roblox" chip on the recents row at
  `/stats/faceit`, sets `roblox_started_at` + place/job ids.
- **`match_end`** → sets `roblox_ended_at`. Does **not** auto-publish
  scores — captains still run `/scrimmage report` in Discord. (Auto-
  finalization from goal-event counts is on the roadmap.)

---

## 10. Open questions for the Roblox dev

When you have a moment, please confirm with VF staff:

1. Where is the in-game host UI / chat command? (`:start match` vs a
   button vs both)
2. Will events ride a single shared HMAC, or one per Roblox `placeId`?
3. Do you want a "dry-run" header (`x-vf-dryrun: 1`) so test sessions
   never write to the live DB?
4. Is there a per-event ack you'd like surfaced in your Roblox console?
