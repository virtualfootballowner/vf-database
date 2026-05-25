-- Remove mvksczek (Discord bvirdy) from Morocco S3 roster.

delete from public.player_team_seasons
where player_id = (
    select id
    from public.players
    where lower(btrim(roblox_username)) = lower('mvksczek')
       or discord_username ilike 'bvirdy'
    limit 1
  )
  and team_slug = 'morocco'
  and season = 3;
