-- Manual all-time assist totals (ground truth; re-running refresh_player_goal_assist_totals will recompute from match_events and may overwrite).
update public.players
set assists_total = 7,
    updated_at = now()
where lower(trim(roblox_username)) = 'booskioo';

update public.players
set assists_total = 8,
    updated_at = now()
where lower(trim(roblox_username)) = 'wizente';
