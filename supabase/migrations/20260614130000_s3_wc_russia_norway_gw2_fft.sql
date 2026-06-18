-- S3-WC-G-F-03: Russia 3–0 North Korea (FFT forfeit).
-- S3-WC-G-F-04: Japan 0–3 Norway (FFT forfeit).

delete from public.match_events me
using public.matches m
where me.match_id = m.id
  and m.roblox_match_id in ('S3-WC-G-F-03', 'S3-WC-G-F-04');

update public.matches
set
  home_score = 3,
  away_score = 0,
  status = 'completed',
  fft = 'Yes',
  ended_at = coalesce(ended_at, now())
where roblox_match_id = 'S3-WC-G-F-03';

update public.matches
set
  home_score = 0,
  away_score = 3,
  status = 'completed',
  fft = 'Yes',
  ended_at = coalesce(ended_at, now())
where roblox_match_id = 'S3-WC-G-F-04';
