-- S3-WC-G-B-02 (Albania 4–2 Greece): add missing cards and Greece scorers/assists.

insert into public.match_events (match_id, player_id, team_id, event_type, minute, details)
select
  m.id,
  p.id,
  t.id,
  v.event_type,
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
    ('0zrneI',       'albania', 'yellow_card', 1),
    ('verratli',     'albania', 'yellow_card', 1),
    ('LJ_EDITZS',    'greece',  'yellow_card', 1),
    ('verratli',     'greece',  'goal',        1),
    ('stickmasterders', 'greece', 'goal',      1),
    ('stickmasterders', 'greece', 'assist',    1),
    ('longfoot7',    'greece',  'assist',      1)
) as v(username, team_slug, event_type, event_count)
join public.players p on lower(p.roblox_username) = lower(v.username)
join public.teams t on t.slug = v.team_slug
where m.roblox_match_id = 'S3-WC-G-B-02'
  and not exists (
    select 1
    from public.match_events me
    where me.match_id = m.id
      and me.player_id = p.id
      and me.event_type = v.event_type
      and me.team_id = t.id
      and coalesce(nullif(trim(me.details ->> 'count'), '')::integer, 1) = v.event_count
  );

select public.refresh_player_goal_assist_totals();
