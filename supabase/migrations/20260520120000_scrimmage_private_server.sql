-- =============================================================
-- VF FACEIT — Private server columns + auto-finalization tweaks
-- =============================================================
-- Adds the columns needed for the Roblox lobby place to record a
-- reserved (private) server back to the match row, plus the deep
-- link the bot posts in #scrimmage-lobby for players to join.
--
-- Architecture (see docs/roblox-private-server-architecture.md):
--   1. Bot writes scrimmage_matches.roblox_join_link as soon as the
--      ready check passes — a deep link to the VF lobby place with
--      LaunchData = match_code.
--   2. First player joins the lobby place; the lobby Lua checks
--      verify-player, calls TeleportService:ReserveServer(MAIN_PLACE_ID)
--      to mint a reserved server, and POSTs the access code +
--      privateServerId back via /api/scrimmage/server-info.
--   3. Subsequent players hitting the lobby place reuse the same
--      reserved code (returned by verify-player).
-- =============================================================

alter table public.scrimmage_matches
  add column if not exists roblox_join_link text,
  add column if not exists reserved_server_code text,
  add column if not exists private_server_id text;

create index if not exists scrimmage_matches_reserved_server_idx
  on public.scrimmage_matches (reserved_server_code)
  where reserved_server_code is not null;

comment on column public.scrimmage_matches.roblox_join_link is
  'Deep link the bot posts in Discord for players to join; opens the VF lobby place with LaunchData=match_code.';
comment on column public.scrimmage_matches.reserved_server_code is
  'Reserved-server access code returned by TeleportService:ReserveServer; consumed by TeleportService:TeleportToPrivateServer.';
comment on column public.scrimmage_matches.private_server_id is
  'Roblox privateServerId for the reserved instance (informational; not required to teleport).';
