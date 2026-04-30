-- Matches archive + team catalog fields for moving site/stats off repo files.

-- Teams: slugs, copy, seasons (logo_url already exists on production schema)
alter table public.teams add column if not exists slug text;
alter table public.teams add column if not exists form_label text;
alter table public.teams add column if not exists seasons smallint[];

create unique index if not exists teams_slug_unique
  on public.teams (slug)
  where slug is not null and length(trim(slug)) > 0;

-- Tournaments: explicit season + competition label (in addition to name)
alter table public.tournaments add column if not exists season smallint;
alter table public.tournaments add column if not exists competition text;

-- Matches: parity with MatchRecord in matches-data.ts
alter table public.matches add column if not exists season smallint;
alter table public.matches add column if not exists competition text;
alter table public.matches add column if not exists game_week_label text;
alter table public.matches add column if not exists fft text;
alter table public.matches add column if not exists match_notes text;

alter table public.matches drop constraint if exists matches_fft_check;
alter table public.matches add constraint matches_fft_check
  check (fft is null or fft in ('No', 'Yes', 'Partial', 'Mercy'));
