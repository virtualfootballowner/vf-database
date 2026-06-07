-- S3-WC-G-C-02: USA 0–3 Somalia (FFT forfeit).

delete from public.match_events me
using public.matches m
where me.match_id = m.id
  and m.roblox_match_id = 'S3-WC-G-C-02';

update public.matches
set
  home_score = 0,
  away_score = 3,
  status = 'completed',
  fft = 'Yes',
  ended_at = coalesce(ended_at, now())
where roblox_match_id = 'S3-WC-G-C-02';
