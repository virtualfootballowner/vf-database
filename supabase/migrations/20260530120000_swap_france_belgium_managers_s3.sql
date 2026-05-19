-- S3: France and Belgium managers requested a swap (rosters unchanged).

update public.team_season_managers
set
  manager_display_name = 'MORTY256x1',
  updated_at = now()
where team_slug = 'france' and season = 3;

update public.team_season_managers
set
  manager_display_name = 'peakvxz',
  updated_at = now()
where team_slug = 'belgium' and season = 3;
