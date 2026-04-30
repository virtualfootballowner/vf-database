-- Match website CSV: MOTM, FFT (forfeit), No Stats badge rows on match_events.
alter type public.event_type add value if not exists 'motm';
alter type public.event_type add value if not exists 'forfeit';
alter type public.event_type add value if not exists 'no_stats';
