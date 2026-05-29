-- Add rcziua (1713828103) to Brazil S3 roster.

insert into public.player_team_seasons (player_id, team_slug, season)
select id, 'brazil', 3
from public.players
where roblox_user_id = '1713828103'
   or lower(btrim(roblox_username)) = lower('rcziua')
on conflict (player_id, team_slug, season) do nothing;
