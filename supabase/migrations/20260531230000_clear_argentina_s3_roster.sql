-- Clear Argentina roster (Season 3 manual reset).

delete from public.player_team_seasons
where team_slug = 'argentina'
  and season = 3;
