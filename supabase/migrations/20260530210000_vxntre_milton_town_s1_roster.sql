-- Vxntre: Milton Town FC Season 1 roster (verified player row).

insert into public.player_team_seasons (player_id, team_slug, season)
select
  p.id,
  'milton-town-fc',
  1
from public.players p
where lower(btrim(p.roblox_username)) = lower('Vxntre')
  and p.roblox_user_id is not null
on conflict (player_id, team_slug, season) do nothing;
