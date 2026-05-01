-- EL1-GW5-01: credit rykiraa's goal + assist rows to booskioo (25796457).
update public.match_events me
set
  player_id = p.id,
  details = jsonb_set(
    jsonb_set(me.details, '{player}', '"booskioo"', true),
    '{roblox_user_id}', '"25796457"', true
  )
from public.matches m, public.players p
where me.match_id = m.id
  and m.roblox_match_id = 'EL1-GW5-01'
  and me.event_type in ('goal', 'assist')
  and coalesce(me.details->>'player', '') = 'rykiraa'
  and coalesce(me.details->>'roblox_user_id', '') = '104144813'
  and p.roblox_user_id = '25796457';

select public.refresh_player_goal_assist_totals();
