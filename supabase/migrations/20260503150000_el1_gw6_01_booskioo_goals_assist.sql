-- EL1-GW6-01: rykiraa Andover goals → booskioo (2 goals total; drop extra 1-goal row).
-- vnpthu assist → booskioo (1 assist).
delete from public.match_events me
using public.matches m
where me.match_id = m.id
  and m.roblox_match_id = 'EL1-GW6-01'
  and me.event_type = 'goal'
  and coalesce(me.details->>'player', '') = 'rykiraa'
  and coalesce((nullif(trim(me.details->>'count'), ''))::int, 0) = 1;

update public.match_events me
set
  player_id = p.id,
  details = jsonb_set(
    jsonb_set(
      jsonb_set(me.details, '{player}', '"booskioo"', true),
      '{roblox_user_id}', '"25796457"', true
    ),
    '{notes}', 'null'::jsonb
  )
from public.matches m, public.players p
where me.match_id = m.id
  and m.roblox_match_id = 'EL1-GW6-01'
  and me.event_type = 'goal'
  and coalesce(me.details->>'player', '') = 'rykiraa'
  and coalesce((nullif(trim(me.details->>'count'), ''))::int, 0) = 2
  and p.roblox_user_id = '25796457';

update public.match_events me
set
  player_id = p.id,
  details = jsonb_set(
    jsonb_set(me.details, '{player}', '"booskioo"', true),
    '{roblox_user_id}', '"25796457"', true
  )
from public.matches m, public.players p
where me.match_id = m.id
  and m.roblox_match_id = 'EL1-GW6-01'
  and me.event_type = 'assist'
  and coalesce(me.details->>'player', '') = 'vnpthu'
  and p.roblox_user_id = '25796457';

select public.refresh_player_goal_assist_totals();
