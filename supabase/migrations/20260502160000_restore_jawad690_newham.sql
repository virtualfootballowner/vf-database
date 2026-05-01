-- Restore Jawad690 (Roblox user id 71165145) and S1 Newham squad link after name-only purge.

insert into public.players (roblox_username, roblox_user_id, discord_id, discord_username)
select 'Jawad690', '71165145', null, null
where not exists (
  select 1 from public.players p where p.roblox_user_id = '71165145'
);

insert into public.player_team_seasons (player_id, team_slug, season)
select id, 'newham-united', 1::smallint
from public.players
where roblox_user_id = '71165145'
on conflict (player_id, team_slug, season) do nothing;
