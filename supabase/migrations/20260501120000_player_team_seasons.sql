-- Per-season club roster links (squadsheets). One row per player per team per season.
create table if not exists public.player_team_seasons (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.players (id) on delete cascade,
  team_slug text not null,
  season smallint not null,
  games integer,
  inserted_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint player_team_seasons_unique_membership unique (player_id, team_slug, season)
);

create index if not exists player_team_seasons_team_season_idx
  on public.player_team_seasons (team_slug, season);

create index if not exists player_team_seasons_player_idx
  on public.player_team_seasons (player_id);

comment on table public.player_team_seasons is
  'Club roster by season; populate from match events (e.g. scorers + assisters).';

alter table public.player_team_seasons enable row level security;

drop policy if exists "player_team_seasons_select_public" on public.player_team_seasons;
create policy "player_team_seasons_select_public"
  on public.player_team_seasons for select
  using (true);
