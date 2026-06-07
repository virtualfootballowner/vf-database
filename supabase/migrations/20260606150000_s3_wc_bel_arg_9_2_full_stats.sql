-- S3-WC-G-D-01: Belgium 9–2 Argentina (corrected full stats).

delete from public.match_events me
using public.matches m
where me.match_id = m.id
  and m.roblox_match_id = 'S3-WC-G-D-01';

update public.matches
set
  home_score = 9,
  away_score = 2,
  status = 'completed',
  fft = null,
  ended_at = coalesce(ended_at, now())
where roblox_match_id = 'S3-WC-G-D-01';

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
    ('peakvxz',           'belgium',   'goal',   1),
    ('chrisu1234567890',  'belgium',   'goal',   4),
    ('stallker270511',    'belgium',   'goal',   2),
    ('Kaan113345',        'belgium',   'goal',   1),
    ('Locktarogar_ZugZug','belgium',   'goal',   1),
    ('peakvxz',           'belgium',   'assist', 2),
    ('bodyfeinter',       'belgium',   'assist', 5),
    ('Drizlify',          'belgium',   'assist', 1),
    ('Nizjaida',          'argentina', 'goal',   2),
    ('rcziua',            'argentina', 'assist', 1),
    ('bodyfeinter',       'belgium',   'motm',   1)
) as v(username, team_slug, event_type, event_count)
join public.players p on lower(p.roblox_username) = lower(v.username)
join public.teams t on t.slug = v.team_slug
where m.roblox_match_id = 'S3-WC-G-D-01';

select public.refresh_player_goal_assist_totals();
