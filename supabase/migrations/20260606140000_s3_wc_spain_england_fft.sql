-- S3-WC-G-B-01: Spain 3–0 England (FFT forfeit).

update public.matches
set
  home_score = 3,
  away_score = 0,
  status = 'completed',
  fft = 'Yes',
  ended_at = coalesce(ended_at, now())
where roblox_match_id = 'S3-WC-G-B-01';
