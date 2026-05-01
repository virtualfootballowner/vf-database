-- Recompute goals_total / assists_total from match_events only (no hand-set player totals).
select public.refresh_player_goal_assist_totals();
