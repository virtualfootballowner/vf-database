-- S3-WC-G-C-03: France 3–0 USA (FFT forfeit).

delete from public.match_events me
using public.matches m
where me.match_id = m.id
  and m.roblox_match_id = 'S3-WC-G-C-03';

update public.matches
set
  home_score = 3,
  away_score = 0,
  status = 'completed',
  fft = 'Yes',
  ended_at = coalesce(ended_at, now())
where roblox_match_id = 'S3-WC-G-C-03';
