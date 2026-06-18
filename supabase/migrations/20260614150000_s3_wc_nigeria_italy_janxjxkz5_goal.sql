-- S3-WC-G-A-03: Nigeria 8–1 Italy — add Janxjxkz5 goal (no assist).

insert into public.match_events (match_id, player_id, team_id, event_type, minute, details)
select
  m.id,
  p.id,
  t.id,
  'goal',
  null,
  jsonb_build_object(
    'source', 'manual_stats_patch',
    'player', p.roblox_username,
    'roblox_user_id', p.roblox_user_id,
    'count', 1,
    'notes', 'Added missing Janxjxkz5 goal — no assist'
  )
from public.matches m
join public.players p on lower(p.roblox_username) = 'janxjxkz5'
join public.teams t on t.slug = 'nigeria'
where m.roblox_match_id = 'S3-WC-G-A-03'
  and not exists (
    select 1
    from public.match_events me
    where me.match_id = m.id
      and me.player_id = p.id
      and me.team_id = t.id
      and me.event_type = 'goal'
      and coalesce(me.details ->> 'notes', '') like '%Added missing Janxjxkz5 goal%'
  );

update public.matches
set
  home_score = 8,
  away_score = 1,
  status = 'completed',
  ended_at = coalesce(ended_at, now())
where roblox_match_id = 'S3-WC-G-A-03';
