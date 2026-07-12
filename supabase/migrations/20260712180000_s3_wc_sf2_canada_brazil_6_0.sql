-- S3-WC-SF-02: Canada 6–0 Brazil (full stats).
-- Canada: PERPGAI 2G, odaydabbaagh 2G + MOTM, booskioo 1G, 123Taras123 1G 2A
-- Brazil: harmoush YC

do $$
declare
  home_id uuid;
  away_id uuid;
  tourney uuid;
  match_row uuid;
begin
  select id into tourney
  from public.tournaments
  where season = 3 and competition = 'World Cup'
  limit 1;

  select id into home_id from public.teams where slug = 'canada' limit 1;
  select id into away_id from public.teams where slug = 'brazil' limit 1;

  update public.fixtures
  set
    home_team_name = 'Canada',
    away_team_name = 'Brazil',
    metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
      'scheduled_at', '2026-07-11T19:00:00.000Z',
      'calendar_date', '2026-07-11',
      'day_label', 'Semi-final 2',
      'home_slug', 'canada',
      'away_slug', 'brazil',
      'home_slot', 'Canada',
      'away_slot', 'Brazil'
    ),
    updated_at = now()
  where season = 3
    and competition = 'World Cup'
    and fixture_code = 'S3-WC-SF-02';

  select id into match_row from public.matches where roblox_match_id = 'S3-WC-SF-02' limit 1;

  if match_row is null and tourney is not null and home_id is not null and away_id is not null then
    insert into public.matches (
      tournament_id, home_team_id, away_team_id, home_score, away_score,
      stage, status, scheduled_at, roblox_match_id, season, competition,
      game_week_label, fft, match_notes, ended_at
    ) values (
      tourney, home_id, away_id, 6, 0,
      'Semi-Final', 'completed', '2026-07-11T19:00:00.000Z'::timestamptz,
      'S3-WC-SF-02', 3, 'World Cup', 'Semi-Final', 'No',
      'Stadium: TBD', now()
    );
  elsif match_row is not null then
    update public.matches
    set
      home_team_id = home_id,
      away_team_id = away_id,
      home_score = 6,
      away_score = 0,
      status = 'completed',
      scheduled_at = '2026-07-11T19:00:00.000Z'::timestamptz,
      fft = 'No',
      match_notes = 'Stadium: TBD',
      ended_at = coalesce(ended_at, now()),
      updated_at = now()
    where id = match_row;
  end if;
end $$;

delete from public.match_events me
using public.matches m
where me.match_id = m.id
  and m.roblox_match_id = 'S3-WC-SF-02';

insert into public.match_events (match_id, player_id, team_id, event_type, minute, details)
select
  m.id,
  p.id,
  t.id,
  v.event_type::event_type,
  null,
  jsonb_build_object(
    'source', 'manual_stats_patch',
    'player', p.roblox_username,
    'roblox_user_id', p.roblox_user_id,
    'count', v.event_count,
    'notes', null
  )
from public.matches m
cross join (
  values
    ('PERPGAI',       'canada', 'goal',        2),
    ('odaydabbaagh',  'canada', 'goal',        2),
    ('booskioo',      'canada', 'goal',        1),
    ('123Taras123',   'canada', 'goal',        1),
    ('123Taras123',   'canada', 'assist',      2),
    ('harmoush',      'brazil', 'yellow_card', 1),
    ('odaydabbaagh',  'canada', 'motm',        1)
) as v(username, team_slug, event_type, event_count)
join public.players p on lower(p.roblox_username) = lower(v.username)
join public.teams t on t.slug = v.team_slug
where m.roblox_match_id = 'S3-WC-SF-02';

select public.link_fixtures_to_matches();
select public.refresh_player_goal_assist_totals();
