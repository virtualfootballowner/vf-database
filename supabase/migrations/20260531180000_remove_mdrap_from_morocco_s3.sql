-- Remove mdrap from Morocco S3 roster.

delete from public.player_team_seasons
where player_id = (
    select id
    from public.players
    where lower(btrim(roblox_username)) = lower('mdrap')
       or discord_username ilike 'mdrap'
    limit 1
  )
  and team_slug = 'morocco'
  and season = 3;
