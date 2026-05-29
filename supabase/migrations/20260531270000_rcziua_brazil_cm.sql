-- Set rcziua (1713828103) position to CM on Brazil S3 roster.

update public.players
set position = 'CM', updated_at = now()
where roblox_user_id = '1713828103';

update public.player_team_seasons
set roster_position = 'CM', updated_at = now()
where player_id = (
    select id from public.players where roblox_user_id = '1713828103' limit 1
  )
  and team_slug = 'brazil'
  and season = 3;
