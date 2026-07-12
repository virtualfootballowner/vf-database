-- S3-WC-QF-01: Nigeria 2–2 Spain player stats (+ pens already on match_notes).
-- Nigeria: Teskid10 1G, itchy 1G, zzIacko 1A
-- Spain: Absxul 2G, parrytiming 1A, House77O 1A + RC, zurtied YC

insert into public.players (roblox_username, roblox_user_id, verified_at)
select 'itchy', '658471', now()
where not exists (
  select 1 from public.players p
  where p.roblox_user_id = '658471'
     or lower(btrim(p.roblox_username)) = 'itchy'
);

insert into public.player_team_seasons (player_id, team_slug, season)
select id, 'nigeria', 3
from public.players
where roblox_user_id = '658471'
   or lower(btrim(roblox_username)) = 'itchy'
on conflict (player_id, team_slug, season) do nothing;

delete from public.match_events me
using public.matches m
where me.match_id = m.id
  and m.roblox_match_id = 'S3-WC-QF-01';

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
    ('Teskid10',     'nigeria', 'goal',        1),
    ('itchy',        'nigeria', 'goal',        1),
    ('zzIacko',      'nigeria', 'assist',      1),
    ('Absxul',       'spain',   'goal',        2),
    ('parrytiming',  'spain',   'assist',      1),
    ('House77O',     'spain',   'assist',      1),
    ('House77O',     'spain',   'red_card',    1),
    ('zurtied',      'spain',   'yellow_card', 1)
) as v(username, team_slug, event_type, event_count)
join public.players p on lower(p.roblox_username) = lower(v.username)
join public.teams t on t.slug = v.team_slug
where m.roblox_match_id = 'S3-WC-QF-01';

select public.refresh_player_goal_assist_totals();
