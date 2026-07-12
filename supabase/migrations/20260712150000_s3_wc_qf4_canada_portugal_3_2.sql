-- S3-WC-QF-04: Canada 3–2 Portugal (full stats).
-- Canada: booskioo 2G 1A, odaydabbaagh 1G, appparitixn 1A · MOTM booskioo
-- Portugal: CORPORAL_PIGO 1G, vqzalo 1G, GRocHzz 1A

delete from public.match_events me
using public.matches m
where me.match_id = m.id
  and m.roblox_match_id = 'S3-WC-QF-04';

update public.matches
set
  home_score = 3,
  away_score = 2,
  status = 'completed',
  fft = 'No',
  ended_at = coalesce(ended_at, now()),
  updated_at = now()
where roblox_match_id = 'S3-WC-QF-04';

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
    ('booskioo',       'canada',   'goal',   2),
    ('odaydabbaagh',   'canada',   'goal',   1),
    ('booskioo',       'canada',   'assist', 1),
    ('appparitixn',    'canada',   'assist', 1),
    ('CORPORAL_PIGO',  'portugal', 'goal',   1),
    ('vqzalo',         'portugal', 'goal',   1),
    ('GRocHzz',        'portugal', 'assist', 1),
    ('booskioo',       'canada',   'motm',   1)
) as v(username, team_slug, event_type, event_count)
join public.players p on lower(p.roblox_username) = lower(v.username)
join public.teams t on t.slug = v.team_slug
where m.roblox_match_id = 'S3-WC-QF-04';

select public.refresh_player_goal_assist_totals();
