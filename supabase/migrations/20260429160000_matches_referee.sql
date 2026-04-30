-- Website archive: who refereed the match (display label, often Discord username).
alter table public.matches add column if not exists referee text;
