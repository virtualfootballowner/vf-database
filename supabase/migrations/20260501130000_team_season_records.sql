-- Win / loss / draw totals per club per season (from completed `matches` scores).
create table if not exists public.team_season_records (
  team_slug text not null,
  season smallint not null,
  wins smallint not null default 0,
  losses smallint not null default 0,
  draws smallint not null default 0,
  matches_played smallint not null default 0,
  inserted_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint team_season_records_pkey primary key (team_slug, season)
);

create index if not exists team_season_records_season_idx
  on public.team_season_records (season);

comment on table public.team_season_records is
  'Aggregated league record per team_slug and season; fill from `matches` results.';

alter table public.team_season_records enable row level security;

drop policy if exists "team_season_records_select_public" on public.team_season_records;
create policy "team_season_records_select_public"
  on public.team_season_records for select
  using (true);
