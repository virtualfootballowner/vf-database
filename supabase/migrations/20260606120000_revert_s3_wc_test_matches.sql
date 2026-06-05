-- Revert S3 World Cup test results: France v Canada (S3-WC-G-C-01) and Brazil v Ukraine (S3-WC-G-D-02).

delete from public.match_events
where match_id in (
  select id
  from public.matches
  where roblox_match_id in ('S3-WC-G-C-01', 'S3-WC-G-D-02')
);

update public.matches
set
  status = 'scheduled',
  home_score = 0,
  away_score = 0,
  ended_at = null
where roblox_match_id in ('S3-WC-G-C-01', 'S3-WC-G-D-02');

select public.refresh_player_goal_assist_totals();
