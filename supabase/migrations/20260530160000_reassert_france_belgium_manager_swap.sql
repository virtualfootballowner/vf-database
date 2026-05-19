-- Reassert S3 France ↔ Belgium manager swap (idempotent).

update public.team_season_managers
set
  manager_display_name = 'MORTY256x1',
  manager_discord_id = '952254182440722442',
  updated_at = now()
where team_slug = 'france' and season = 3;

update public.team_season_managers
set
  manager_display_name = 'peakvxz',
  manager_discord_id = '1211658729276309577',
  updated_at = now()
where team_slug = 'belgium' and season = 3;
