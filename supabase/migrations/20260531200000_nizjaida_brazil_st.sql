-- Set Nizjaida (682389939) position to ST on Brazil S3 roster.

update public.players
set position = 'ST', updated_at = now()
where roblox_user_id = '682389939';

update public.player_team_seasons
set roster_position = 'ST', updated_at = now()
where player_id = (
    select id from public.players where roblox_user_id = '682389939' limit 1
  )
  and team_slug = 'brazil'
  and season = 3;
