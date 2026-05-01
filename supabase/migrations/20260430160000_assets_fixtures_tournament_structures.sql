-- Media catalog + saved fixture grids + tournament structure metadata (S1 / S2 / S3).

-- -----------------------------------------------------------------------------
-- Assets: URLs (and optional storage paths) keyed by scope — teams, site, tourney.
-- -----------------------------------------------------------------------------
create table if not exists public.assets (
  id uuid primary key default gen_random_uuid(),
  scope text not null check (scope in ('site', 'team', 'tournament', 'season')),
  ref_slug text not null default '',
  title text,
  kind text not null default 'logo'
    check (kind in ('logo', 'crest', 'banner', 'hero', 'icon', 'misc')),
  public_url text not null,
  storage_path text,
  metadata jsonb not null default '{}',
  inserted_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists assets_scope_ref_kind_unique
  on public.assets (scope, ref_slug, kind);

create index if not exists assets_scope_idx on public.assets (scope);
create index if not exists assets_ref_slug_idx on public.assets (ref_slug);

-- -----------------------------------------------------------------------------
-- Tournaments: structure tags (aligns S1 single-table+knockout, S2 multi-league,
-- S3 6×4 World Cup → R16 → final).
-- -----------------------------------------------------------------------------
alter table public.tournaments add column if not exists structure_kind text;
alter table public.tournaments add column if not exists structure_config jsonb not null default '{}';

alter table public.tournaments drop constraint if exists tournaments_structure_kind_check;
alter table public.tournaments add constraint tournaments_structure_kind_check
  check (
    structure_kind is null
    or structure_kind in (
      's1_euroleague_round_robin_knockout',
      's2_multi_league',
      's3_world_cup_24'
    )
  );

comment on column public.tournaments.structure_kind is
  's1_euroleague_round_robin_knockout | s2_multi_league | s3_world_cup_24';
comment on column public.tournaments.structure_config is
  'JSON: groups count, teams_per_group, KO rules, etc.';

-- -----------------------------------------------------------------------------
-- Fixtures: schedule slots (pairings / bracket positions). Team names match
-- website catalog; match_id links after import via roblox_match_id.
-- -----------------------------------------------------------------------------
create table if not exists public.fixtures (
  id uuid primary key default gen_random_uuid(),
  season smallint not null,
  competition text not null,
  fixture_code text not null,
  stage text not null,
  round_order integer not null default 0,
  group_code text,
  home_team_name text not null default '',
  away_team_name text not null default '',
  roblox_match_id text,
  match_id uuid references public.matches (id) on delete set null,
  metadata jsonb not null default '{}',
  inserted_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fixtures_fixture_code_nonempty check (length(trim(fixture_code)) > 0),
  constraint fixtures_unique_slot unique (season, competition, fixture_code)
);

create index if not exists fixtures_season_competition_idx
  on public.fixtures (season, competition);

create index if not exists fixtures_roblox_match_id_idx
  on public.fixtures (roblox_match_id)
  where roblox_match_id is not null and btrim(roblox_match_id) <> '';

create index if not exists fixtures_match_id_idx
  on public.fixtures (match_id)
  where match_id is not null;

comment on table public.fixtures is
  'Season schedule & bracket slots. S3 = 6 groups × 4 teams (24) → R16 (8) → QF → SF → F.';

-- Called after match import so `fixtures.match_id` points at UUID rows.
create or replace function public.link_fixtures_to_matches()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  n integer;
begin
  update public.fixtures f
  set match_id = m.id,
      updated_at = now()
  from public.matches m
  where f.roblox_match_id is not null
    and btrim(f.roblox_match_id) <> ''
    and m.roblox_match_id = f.roblox_match_id;

  get diagnostics n = row_count;
  return n;
end;
$$;

comment on function public.link_fixtures_to_matches() is
  'Sets fixtures.match_id from fixtures.roblox_match_id ↔ matches.roblox_match_id.';

revoke all on function public.link_fixtures_to_matches() from public;
grant execute on function public.link_fixtures_to_matches() to service_role;

-- -----------------------------------------------------------------------------
-- RLS (read-only public; service role writes — same pattern as matches).
-- -----------------------------------------------------------------------------
alter table public.assets enable row level security;
alter table public.fixtures enable row level security;

drop policy if exists "assets_select_public" on public.assets;
create policy "assets_select_public"
  on public.assets for select
  using (true);

drop policy if exists "fixtures_select_public" on public.fixtures;
create policy "fixtures_select_public"
  on public.fixtures for select
  using (true);
