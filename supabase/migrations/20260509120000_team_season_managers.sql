-- Per-team, per-season head coach / manager display name.
-- Rows exist for every catalog season a team plays; `manager_display_name` may be null (vacant / TBD).

create table if not exists public.team_season_managers (
  team_slug text not null,
  season smallint not null,
  manager_display_name text,
  inserted_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint team_season_managers_pkey primary key (team_slug, season),
  constraint team_season_managers_season_check check (season in (1, 2, 3))
);

create index if not exists team_season_managers_season_idx
  on public.team_season_managers (season);

comment on table public.team_season_managers is
  'Manager (head coach) per team slug and season. Null name means not set yet.';

alter table public.team_season_managers enable row level security;

drop policy if exists "team_season_managers_select_public" on public.team_season_managers;
create policy "team_season_managers_select_public"
  on public.team_season_managers for select
  using (true);

-- Season 1 & 2 · league clubs (manager names seeded via repo script / manual updates; start null)
insert into public.team_season_managers (team_slug, season, manager_display_name) values
  ('milton-town-fc', 1, null),
  ('milton-town-fc', 2, null),
  ('newham-united', 1, null),
  ('newham-united', 2, null),
  ('nottingham-rangers', 1, null),
  ('nottingham-rangers', 2, null),
  ('andover-fc', 1, null),
  ('andover-fc', 2, null),
  ('eltham-united', 1, null),
  ('eltham-united', 2, null),
  ('newport-wanderers-fc', 1, null),
  ('newport-wanderers-fc', 2, null),
  ('viola-fc', 1, null),
  ('viola-fc', 2, null),
  ('stafford-wanderers', 1, null),
  ('canterbury-fc', 2, null),
  ('stanford-fc', 2, null),
  ('deportivo-di-gnoa', 2, null),
  ('ac-casole', 2, null),
  ('tre-torre-libertas-fc', 2, null),
  ('venezia-ac', 2, null),
  ('cartigiana-fc', 2, null),
  ('sassari-calcio', 2, null),
  ('ambasciatori-milano', 2, null)
on conflict (team_slug, season) do nothing;

-- Season 3 · national teams (slots only until appointed)
insert into public.team_season_managers (team_slug, season, manager_display_name) values
  ('france', 3, null),
  ('spain', 3, null),
  ('england', 3, null),
  ('germany', 3, null),
  ('belgium', 3, null),
  ('croatia', 3, null),
  ('netherlands', 3, null),
  ('italy', 3, null),
  ('portugal', 3, null),
  ('turkiye', 3, null),
  ('brazil', 3, null),
  ('argentina', 3, null),
  ('colombia', 3, null),
  ('uruguay', 3, null),
  ('ecuador', 3, null),
  ('usa', 3, null),
  ('canada', 3, null),
  ('mexico', 3, null),
  ('algeria', 3, null),
  ('nigeria', 3, null),
  ('morocco', 3, null),
  ('south-africa', 3, null),
  ('japan', 3, null),
  ('south-korea', 3, null)
on conflict (team_slug, season) do nothing;
