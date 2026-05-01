-- Single account: display as parrytiming (Roblox 2704701079); was recorded as fivsakai.

update public.players
set roblox_username = 'parrytiming'
where roblox_user_id = '2704701079';

update public.match_events
set details = jsonb_set(details, '{player}', '"parrytiming"', true)
where coalesce(details->>'roblox_user_id', '') = '2704701079'
  and coalesce(details->>'player', '') = 'fivsakai';

select public.refresh_player_goal_assist_totals();
