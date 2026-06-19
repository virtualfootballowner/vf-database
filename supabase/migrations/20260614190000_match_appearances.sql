-- Match sheet lineups (who played), separate from stat events.
-- Populated by Roblox record_world_cup_match() at matchend.

create table if not exists public.match_appearances (
  match_id uuid not null references public.matches (id) on delete cascade,
  player_id uuid not null references public.players (id) on delete cascade,
  team_id uuid not null references public.teams (id) on delete restrict,
  side text not null check (side in ('home', 'away')),
  tournament_id uuid references public.tournaments (id) on delete set null,
  season smallint,
  created_at timestamptz not null default now(),
  primary key (match_id, player_id)
);

create index if not exists match_appearances_player_idx
  on public.match_appearances (player_id);

create index if not exists match_appearances_match_idx
  on public.match_appearances (match_id);

comment on table public.match_appearances is
  'One row per player on the match sheet; used for profile appearances beyond stat events.';

alter table public.match_appearances enable row level security;

drop policy if exists "match_appearances_select_public" on public.match_appearances;
create policy "match_appearances_select_public"
  on public.match_appearances for select
  to anon, authenticated
  using (true);

grant select on table public.match_appearances to anon, authenticated;
grant all on table public.match_appearances to service_role;
