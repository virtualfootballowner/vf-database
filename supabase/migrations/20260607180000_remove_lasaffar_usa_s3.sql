-- Remove LaSaffar (5043549418) from USA S3 roster.

delete from public.player_team_seasons
where player_id = (
  select id from public.players
  where lower(btrim(roblox_username)) = lower('LaSaffar')
     or roblox_user_id = '5043549418'
  limit 1
)
and team_slug = 'usa'
and season = 3;
