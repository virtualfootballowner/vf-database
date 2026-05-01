-- Season titles (league champion, cup winner). S1 seeded; S2 had no crowned winners per league ops.
create table if not exists public.team_season_honors (
  team_slug text not null,
  season smallint not null,
  honor_kind text not null,
  inserted_at timestamptz not null default now(),
  constraint team_season_honors_pkey primary key (team_slug, season, honor_kind),
  constraint team_season_honors_kind_check check (
    honor_kind in ('euroleague_champion', 'euroblox_cup_champion')
  )
);

create unique index if not exists team_season_honors_season_kind_unique
  on public.team_season_honors (season, honor_kind);

comment on table public.team_season_honors is
  'Per-season honors (e.g. S1 EuroLeague champion, Euroblox Cup champion).';

alter table public.team_season_honors enable row level security;

drop policy if exists "team_season_honors_select_public" on public.team_season_honors;
create policy "team_season_honors_select_public"
  on public.team_season_honors for select
  using (true);

insert into public.team_season_honors (team_slug, season, honor_kind)
values
  ('andover-fc', 1, 'euroleague_champion'),
  ('milton-town-fc', 1, 'euroblox_cup_champion')
on conflict (team_slug, season, honor_kind) do nothing;
