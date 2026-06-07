-- S3-WC-G-B-02: remove erroneous auto-log goal; Greece scorer is stickmasterders.

delete from public.match_events me
using public.matches m, public.players p
where me.match_id = m.id
  and me.player_id = p.id
  and m.roblox_match_id = 'S3-WC-G-B-02'
  and me.event_type = 'goal'
  and lower(p.roblox_username) in ('stickman12455', 'naxou9');

select public.refresh_player_goal_assist_totals();
