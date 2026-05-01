-- BP2-MN-01: fixture was Milton v Newport (2-3), not Newham. Repoint away team + away-side events.
-- BP2-MNH-01: Milton v Newham 0-0 (new row + no_stats placeholder when not present).

update public.matches m
set away_team_id = npt.id
from public.teams npt
where m.roblox_match_id = 'BP2-MN-01'
  and npt.slug = 'newport-wanderers-fc';

update public.match_events me
set team_id = (select id from public.teams where slug = 'newport-wanderers-fc' limit 1)
from public.matches m
where me.match_id = m.id
  and m.roblox_match_id = 'BP2-MN-01'
  and me.team_id = (select id from public.teams where slug = 'newham-united' limit 1);

insert into public.matches (
  tournament_id,
  home_team_id,
  away_team_id,
  home_score,
  away_score,
  stage,
  match_week,
  status,
  scheduled_at,
  ended_at,
  roblox_match_id,
  referee,
  season,
  competition,
  game_week_label,
  fft,
  match_notes
)
select
  src.tournament_id,
  (select id from public.teams where slug = 'milton-town-fc' limit 1),
  (select id from public.teams where slug = 'newham-united' limit 1),
  0,
  0,
  src.stage,
  src.match_week,
  src.status,
  '2024-11-14T12:00:00.000Z'::timestamptz,
  '2024-11-14T12:00:00.000Z'::timestamptz,
  'BP2-MNH-01',
  src.referee,
  src.season,
  src.competition,
  src.game_week_label,
  src.fft,
  '0-0 draw. Split from BP2-MN-01 (that match is Milton v Newport 2-3). Date approximate.'
from public.matches src
where src.roblox_match_id = 'BP2-MN-01'
  and not exists (
    select 1 from public.matches x where x.roblox_match_id = 'BP2-MNH-01'
  );

insert into public.match_events (match_id, player_id, team_id, event_type, minute, details)
select
  m.id,
  null,
  null,
  'no_stats',
  null,
  jsonb_build_object(
    'source', 'vfl_website_csv',
    'player', '—',
    'roblox_user_id', null,
    'count', 0,
    'notes', '0-0 — corrected fixture; no player-level sheet'
  )
from public.matches m
where m.roblox_match_id = 'BP2-MNH-01'
  and not exists (
    select 1 from public.match_events e where e.match_id = m.id
  );

select public.refresh_player_goal_assist_totals();

select public.link_fixtures_to_matches();
