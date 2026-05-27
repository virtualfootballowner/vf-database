-- Add Nizjaida (682389939) to Brazil S3 roster.

insert into public.player_team_seasons (player_id, team_slug, season)
select id, 'brazil', 3
from public.players
where roblox_user_id = '682389939'
   or lower(btrim(roblox_username)) = lower('Nizjaida')
on conflict (player_id, team_slug, season) do nothing;
