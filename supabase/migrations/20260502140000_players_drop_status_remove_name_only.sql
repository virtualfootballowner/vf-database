-- Remove players without a linked Roblox user id (name-only archive rows).
-- Detach events first so imports stay valid if FK is non-null or restrictive.
update public.match_events
set player_id = null
where player_id in (
  select id
  from public.players
  where roblox_user_id is null
     or btrim(coalesce(roblox_user_id, '')) = ''
);

delete from public.players
where roblox_user_id is null
   or btrim(coalesce(roblox_user_id, '')) = '';

alter table public.players drop column if exists status;
