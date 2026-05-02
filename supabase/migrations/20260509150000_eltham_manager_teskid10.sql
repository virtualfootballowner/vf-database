-- Eltham United manager display name correction (Togzema → Teskid10).

update public.team_season_managers set manager_display_name = 'Teskid10'
  where team_slug = 'eltham-united' and season = 1;
update public.team_season_managers set manager_display_name = 'Teskid10'
  where team_slug = 'eltham-united' and season = 2;
