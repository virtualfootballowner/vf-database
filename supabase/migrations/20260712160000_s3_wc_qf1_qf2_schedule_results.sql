-- S3 World Cup QF1 & QF2: schedule + results.
-- QF2 Norway v Belgium · Wed 8 Jul 2026 · 20:00 BST · Norway 3–0 FFT.
-- QF1 Nigeria v Spain · Thu 9 Jul 2026 · 21:00 BST · 2–2 · Nigeria won 7–6 on pens.

do $$
declare
  qf1_home uuid;
  qf1_away uuid;
  qf2_home uuid;
  qf2_away uuid;
  tourney uuid;
  qf1_match uuid;
  qf2_match uuid;
begin
  select id into tourney
  from public.tournaments
  where season = 3 and competition = 'World Cup'
  limit 1;

  select id into qf1_home from public.teams where slug = 'nigeria' limit 1;
  select id into qf1_away from public.teams where slug = 'spain' limit 1;
  select id into qf2_home from public.teams where slug = 'norway' limit 1;
  select id into qf2_away from public.teams where slug = 'belgium' limit 1;

  update public.fixtures
  set
    home_team_name = 'Norway',
    away_team_name = 'Belgium',
    metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
      'scheduled_at', '2026-07-08T19:00:00.000Z',
      'calendar_date', '2026-07-08',
      'day_label', 'QF · Wednesday',
      'home_slug', 'norway',
      'away_slug', 'belgium',
      'home_slot', 'Norway',
      'away_slot', 'Belgium'
    ),
    updated_at = now()
  where season = 3
    and competition = 'World Cup'
    and fixture_code = 'S3-WC-QF-02';

  update public.fixtures
  set
    home_team_name = 'Nigeria',
    away_team_name = 'Spain',
    metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
      'scheduled_at', '2026-07-09T20:00:00.000Z',
      'calendar_date', '2026-07-09',
      'day_label', 'QF · Thursday',
      'home_slug', 'nigeria',
      'away_slug', 'spain',
      'home_slot', 'Nigeria',
      'away_slot', 'Spain'
    ),
    updated_at = now()
  where season = 3
    and competition = 'World Cup'
    and fixture_code = 'S3-WC-QF-01';

  select id into qf2_match from public.matches where roblox_match_id = 'S3-WC-QF-02' limit 1;
  if qf2_match is null and tourney is not null and qf2_home is not null and qf2_away is not null then
    insert into public.matches (
      tournament_id, home_team_id, away_team_id, home_score, away_score,
      stage, status, scheduled_at, roblox_match_id, season, competition,
      game_week_label, fft, match_notes, ended_at
    ) values (
      tourney, qf2_home, qf2_away, 3, 0,
      'Quarter-Final', 'completed', '2026-07-08T19:00:00.000Z'::timestamptz,
      'S3-WC-QF-02', 3, 'World Cup', 'Quarter-Final', 'Yes',
      'Stadium: TBD · FFT', now()
    );
  elsif qf2_match is not null then
    update public.matches
    set
      home_team_id = qf2_home,
      away_team_id = qf2_away,
      home_score = 3,
      away_score = 0,
      status = 'completed',
      scheduled_at = '2026-07-08T19:00:00.000Z'::timestamptz,
      fft = 'Yes',
      match_notes = 'Stadium: TBD · FFT',
      ended_at = coalesce(ended_at, now()),
      updated_at = now()
    where id = qf2_match;
  end if;

  select id into qf1_match from public.matches where roblox_match_id = 'S3-WC-QF-01' limit 1;
  if qf1_match is null and tourney is not null and qf1_home is not null and qf1_away is not null then
    insert into public.matches (
      tournament_id, home_team_id, away_team_id, home_score, away_score,
      stage, status, scheduled_at, roblox_match_id, season, competition,
      game_week_label, fft, match_notes, ended_at
    ) values (
      tourney, qf1_home, qf1_away, 2, 2,
      'Quarter-Final', 'completed', '2026-07-09T20:00:00.000Z'::timestamptz,
      'S3-WC-QF-01', 3, 'World Cup', 'Quarter-Final', 'No',
      'Stadium: TBD · 2–2 · Nigeria won 7–6 on penalties (pens 6–7)',
      now()
    );
  elsif qf1_match is not null then
    update public.matches
    set
      home_team_id = qf1_home,
      away_team_id = qf1_away,
      home_score = 2,
      away_score = 2,
      status = 'completed',
      scheduled_at = '2026-07-09T20:00:00.000Z'::timestamptz,
      fft = 'No',
      match_notes = 'Stadium: TBD · 2–2 · Nigeria won 7–6 on penalties (pens 6–7)',
      ended_at = coalesce(ended_at, now()),
      updated_at = now()
    where id = qf1_match;
  end if;
end $$;

select public.link_fixtures_to_matches();
