-- S3-WC-G-B-02: Greece scorer is NAXOU9 (not stickmasterders; assist unchanged).

delete from public.match_events me
using public.matches m, public.players p, public.teams t
where me.match_id = m.id
  and me.player_id = p.id
  and me.team_id = t.id
  and m.roblox_match_id = 'S3-WC-G-B-02'
  and me.event_type = 'goal'
  and lower(p.roblox_username) = 'stickmasterders'
  and t.slug = 'greece';

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
    'notes', 'Corrected scorer — was stickmasterders'
  )
from public.matches m
join public.players p on lower(p.roblox_username) = 'naxou9'
join public.teams t on t.slug = 'greece'
where m.roblox_match_id = 'S3-WC-G-B-02'
  and not exists (
    select 1
    from public.match_events me
    where me.match_id = m.id
      and me.player_id = p.id
      and me.event_type = 'goal'
      and me.team_id = t.id
  );

select public.refresh_player_goal_assist_totals();
