# VF Referee Discord server setup

The same VF bot (`DISCORD_BOT_TOKEN`) serves the league guild, VF Media, and the **Referee** guild. Referee-only slash commands are registered only in the referee server so `/ban`, `/contract`, etc. do not appear there.

## Guild and defaults (code fallbacks)

| Variable | Default | Purpose |
|----------|---------|---------|
| `DISCORD_REFEREE_GUILD_ID` | `1506682501605883995` | Referee Discord server |
| `DISCORD_REFEREE_ROLE_ID` | `1507087134497181798` | Granted on Approve |
| `DISCORD_REFEREE_APPROVAL_CHANNEL_ID` | `1508189919732830278` | Application review cards |
| `DISCORD_REFEREE_ASSIGNMENTS_CHANNEL_ID` | `1507090926651179028` | `/ref-fixtures` posts + auto-repost when a match is postponed |
| `DISCORD_REFEREE_STAFF_ROLE_ID` | *(unset)* | Optional head-ref role; staff may also use Manage Roles |

Set these on **Railway** (bot service) if you need non-default ids. After deploy, bot startup logs:

```
[referee] Guild configured: … · role … · approval …
```

## Manual Discord setup

1. Invite the VF bot to guild `1506682501605883995` (use the invite URL logged at bot startup).
2. Create roles: **Referee** (matches `DISCORD_REFEREE_ROLE_ID`), optional **Referee Staff**.
3. Create channels: `#ref-applications` (approval), `#assignments`, optional `#staff-log`.
4. Ensure the bot role is **above** Referee / Staff roles and has **Manage Roles**, **Send Messages**, **Embed Links**.

## Slash commands (referee guild only)

| Command | Who | Action |
|---------|-----|--------|
| `/postverify-ref` | Staff | Post verify card linking to `/verify/referee` |
| `/ref-profile` | Referee | Status, tier, assignment count |
| `/ref-list` | Staff | Active roster from DB |
| `/ref-post` | Staff | Post fixture with **Claim fixture** button |
| `/ref-my-games` | Referee | Claimed fixtures |
| `/ref-unclaim` | Ref / staff | Release a claimed assignment |

## Database

Apply migrations:

- `20260531150000_referees.sql` — roster + applications
- `20260531160000_referee_assignments.sql` — fixture claim flow

When a referee claims a fixture, the bot tries to set `matches.referee` using `match_id` (if provided on `/ref-post`) or by matching season + competition + home/away team names.

## Flow summary

1. Applicant opens `/verify/referee` → Discord + Roblox OAuth → nickname set to Roblox username → card in approval channel.
2. Staff **Approve** → `referees.status = active` + Referee role.
3. Staff `/ref-post` → referees claim in assignments channel.
4. Claim updates assignment and syncs referee name to the match archive when possible.