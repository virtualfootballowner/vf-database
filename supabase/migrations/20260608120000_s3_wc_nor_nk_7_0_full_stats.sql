-- S3-WC-G-F-02: Norway 7–0 North Korea (full goal + assist attribution).

delete from public.match_events me
using public.matches m
where me.match_id = m.id
  and m.roblox_match_id = 'S3-WC-G-F-02';

-- North Korea is home; Norway is away.
update public.matches
set
  home_score = 0,
  away_score = 7,
  status = 'completed',
  fft = null,
  ended_at = coalesce(ended_at, now())
where roblox_match_id = 'S3-WC-G-F-02';

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
    ('killzoneshade', 'norway', 'goal',   3),
    ('yattorei',      'norway', 'goal',   2),
    ('PSYKOO0O',      'norway', 'goal',   1),
    ('ahttuso',       'norway', 'goal',   1),
    ('alIiehayes',    'norway', 'assist', 3),
    ('yattorei',      'norway', 'assist', 1),
    ('killzoneshade', 'norway', 'assist', 2),
    ('ahttuso',       'norway', 'assist', 1)
) as v(username, team_slug, event_type, event_count)
join public.players p on lower(p.roblox_username) = lower(v.username)
join public.teams t on t.slug = v.team_slug
where m.roblox_match_id = 'S3-WC-G-F-02';

select public.refresh_player_goal_assist_totals();
