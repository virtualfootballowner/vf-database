-- S3 World Cup QF3 & QF4: resolved teams + rescheduled kickoffs.
-- QF4 Canada v Portugal · Wed 1 Jul 2026 · 21:00 BST (16:00 EDT).
-- QF3 Somalia v Brazil · Sun 5 Jul 2026 · 18:00 BST (13:00 EDT).

do $$
declare
  qf3_home uuid;
  qf3_away uuid;
  qf4_home uuid;
  qf4_away uuid;
  qf3_match uuid;
  qf4_match uuid;
begin
  select id into qf4_home from public.teams where slug = 'canada' limit 1;
  select id into qf4_away from public.teams where slug = 'portugal' limit 1;
  select id into qf3_home from public.teams where slug = 'somalia' limit 1;
  select id into qf3_away from public.teams where slug = 'brazil' limit 1;

  update public.fixtures
  set
    home_team_name = 'Canada',
    away_team_name = 'Portugal',
    metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
      'scheduled_at', '2026-07-01T20:00:00.000Z',
      'calendar_date', '2026-07-01',
      'day_label', 'QF · Wednesday',
      'home_slug', 'canada',
      'away_slug', 'portugal',
      'home_slot', 'Canada',
      'away_slot', 'Portugal'
    ),
    updated_at = now()
  where season = 3
    and competition = 'World Cup'
    and fixture_code = 'S3-WC-QF-04';

  update public.fixtures
  set
    home_team_name = 'Somalia',
    away_team_name = 'Brazil',
    metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
      'scheduled_at', '2026-07-05T17:00:00.000Z',
      'calendar_date', '2026-07-05',
      'day_label', 'QF · Sunday',
      'home_slug', 'somalia',
      'away_slug', 'brazil',
      'home_slot', 'Somalia',
      'away_slot', 'Brazil'
    ),
    updated_at = now()
  where season = 3
    and competition = 'World Cup'
    and fixture_code = 'S3-WC-QF-03';

  select id into qf4_match
  from public.matches
  where roblox_match_id = 'S3-WC-QF-04'
  limit 1;

  if qf4_match is not null and qf4_home is not null and qf4_away is not null then
    update public.matches
    set
      home_team_id = qf4_home,
      away_team_id = qf4_away,
      scheduled_at = '2026-07-01T20:00:00.000Z'::timestamptz,
      status = case when status = 'completed' then status else 'scheduled' end,
      updated_at = now()
    where id = qf4_match
      and status = 'scheduled';
  end if;

  select id into qf3_match
  from public.matches
  where roblox_match_id = 'S3-WC-QF-03'
  limit 1;

  if qf3_match is not null and qf3_home is not null and qf3_away is not null then
    update public.matches
    set
      home_team_id = qf3_home,
      away_team_id = qf3_away,
      scheduled_at = '2026-07-05T17:00:00.000Z'::timestamptz,
      status = case when status = 'completed' then status else 'scheduled' end,
      updated_at = now()
    where id = qf3_match
      and status = 'scheduled';
  end if;
end $$;
