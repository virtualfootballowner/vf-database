-- Remove yv8k (Discord) / mbuemvo (Roblox) from Japan S3 roster.

delete from public.player_team_seasons
where player_id = (
    select id
    from public.players
    where discord_username ilike 'yv8k'
       or lower(btrim(roblox_username)) = lower('mbuemvo')
    limit 1
  )
  and team_slug = 'japan'
  and season = 3;
