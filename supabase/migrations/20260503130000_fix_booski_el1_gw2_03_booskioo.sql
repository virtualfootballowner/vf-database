-- EL1-GW2-03: goal credited to "booski" is booskioo (Roblox 25796457).
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
  and m.roblox_match_id = 'EL1-GW2-03'
  and me.event_type = 'goal'
  and coalesce(me.details->>'player', '') = 'booski'
  and p.roblox_user_id = '25796457';

select public.refresh_player_goal_assist_totals();
