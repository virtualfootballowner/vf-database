-- SF1 Nigeria v Norway · Fri 10 Jul 2026 · 20:00 BST (scheduled).

do $$
declare
  home_id uuid;
  away_id uuid;
  tourney uuid;
  match_row uuid;
begin
  select id into tourney from public.tournaments where season = 3 and competition = 'World Cup' limit 1;
  select id into home_id from public.teams where slug = 'nigeria' limit 1;
  select id into away_id from public.teams where slug = 'norway' limit 1;

  update public.fixtures
  set
    home_team_name = 'Nigeria',
    away_team_name = 'Norway',
    metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
      'scheduled_at', '2026-07-10T19:00:00.000Z',
      'calendar_date', '2026-07-10',
      'day_label', 'Semi-final 1',
      'home_slug', 'nigeria',
      'away_slug', 'norway',
      'home_slot', 'Nigeria',
      'away_slot', 'Norway'
    ),
    updated_at = now()
  where season = 3 and competition = 'World Cup' and fixture_code = 'S3-WC-SF-01';

  select id into match_row from public.matches where roblox_match_id = 'S3-WC-SF-01' limit 1;
  if match_row is null and tourney is not null and home_id is not null and away_id is not null then
    insert into public.matches (
      tournament_id, home_team_id, away_team_id, home_score, away_score,
      stage, status, scheduled_at, roblox_match_id, season, competition,
      game_week_label, fft, match_notes
    ) values (
      tourney, home_id, away_id, 0, 0,
      'Semi-Final', 'scheduled', '2026-07-10T19:00:00.000Z'::timestamptz,
      'S3-WC-SF-01', 3, 'World Cup', 'Semi-Final', 'No', 'Stadium: TBD'
    );
  elsif match_row is not null then
    update public.matches
    set home_team_id = home_id, away_team_id = away_id,
        scheduled_at = '2026-07-10T19:00:00.000Z'::timestamptz,
        updated_at = now()
    where id = match_row and status = 'scheduled';
  end if;
end $$;

select public.link_fixtures_to_matches();
