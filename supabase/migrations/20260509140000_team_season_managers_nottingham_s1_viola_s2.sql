-- Fix managers if an earlier revision of 20260509130000 was applied:
-- Nottingham S1 = CapV7; Viola S2 = Lxv34ngel (same as S1).

update public.team_season_managers set manager_display_name = 'CapV7'
  where team_slug = 'nottingham-rangers' and season = 1;

update public.team_season_managers set manager_display_name = 'Lxv34ngel'
  where team_slug = 'viola-fc' and season = 2;
