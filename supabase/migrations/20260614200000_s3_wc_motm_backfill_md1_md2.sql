-- S3 World Cup MD1–MD2: backfill missing MOTM events.

delete from public.match_events me
using public.matches m
where me.match_id = m.id
  and me.event_type = 'motm'
  and m.roblox_match_id in (
    'S3-WC-G-A-02',
    'S3-WC-G-E-01',
    'S3-WC-G-E-02',
    'S3-WC-G-F-02',
    'S3-WC-G-F-01',
    'S3-WC-G-A-03',
    'S3-WC-G-B-03',
    'S3-WC-G-D-03',
    'S3-WC-G-A-04',
    'S3-WC-G-E-03',
    'S3-WC-G-E-04',
    'S3-WC-G-C-04'
  );

insert into public.match_events (match_id, player_id, team_id, event_type, minute, details)
select
  m.id,
  p.id,
  t.id,
  'motm'::event_type,
  null,
  jsonb_build_object(
    'source', 'manual_stats_patch',
    'player', p.roblox_username,
    'roblox_user_id', p.roblox_user_id,
    'count', 1,
    'notes', 'MOTM backfill'
  )
from public.matches m
cross join (
  values
    ('S3-WC-G-A-02', 'Rey_Arturo2018', 'mexico'),
    ('S3-WC-G-E-01', 'waqqn', 'morocco'),
    ('S3-WC-G-E-02', 'Vertyxo', 'germany'),
    ('S3-WC-G-F-02', 'killzoneshade', 'norway'),
    ('S3-WC-G-F-01', 'idkwhatnametoodo7', 'russia'),
    ('S3-WC-G-A-03', 'Janxjxkz5', 'nigeria'),
    ('S3-WC-G-B-03', 'WozyPrime', 'spain'),
    ('S3-WC-G-D-03', 'wizente', 'brazil'),
    ('S3-WC-G-A-04', 'Zevgba', 'portugal'),
    ('S3-WC-G-E-03', 'joelfast12', 'germany'),
    ('S3-WC-G-E-04', 'mateiryan', 'switzerland'),
    ('S3-WC-G-C-04', 'booskioo', 'canada')
) as v(match_code, username, team_slug)
join public.players p on lower(p.roblox_username) = lower(v.username)
join public.teams t on t.slug = v.team_slug
where m.roblox_match_id = v.match_code;

select public.refresh_player_goal_assist_totals();
