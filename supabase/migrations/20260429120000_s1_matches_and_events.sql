-- Season archive: canonical matches + per-match events (goals, assists, cards, etc.)
-- Run in Supabase SQL editor or via `supabase db push` when linked.

create table if not exists public.matches (
  id text primary key,
  season integer not null,
  competition text not null,
  game_week text not null,
  played_on date not null,
  home_team text not null,
  home_slug text,
  away_team text not null,
  away_slug text,
  home_score integer not null,
  away_score integer not null,
  stage text not null,
  fft text not null default 'No',
  referee text not null default '—',
  notes text not null default '',
  inserted_at timestamptz not null default now()
);

create index if not exists matches_season_idx on public.matches (season);
create index if not exists matches_played_on_idx on public.matches (played_on);

create table if not exists public.match_events (
  id uuid primary key default gen_random_uuid(),
  match_id text not null references public.matches (id) on delete cascade,
  season integer not null,
  event_type text not null,
  team text not null,
  player text not null,
  roblox_user_id text,
  count integer not null default 1,
  reason text,
  notes text not null default '',
  inserted_at timestamptz not null default now()
);

create index if not exists match_events_match_id_idx on public.match_events (match_id);
create index if not exists match_events_season_idx on public.match_events (season);
create index if not exists match_events_roblox_user_id_idx
  on public.match_events (roblox_user_id)
  where roblox_user_id is not null and btrim(roblox_user_id) <> '';

alter table public.matches enable row level security;
alter table public.match_events enable row level security;

drop policy if exists "matches_select_public" on public.matches;
create policy "matches_select_public"
  on public.matches for select
  using (true);

drop policy if exists "match_events_select_public" on public.match_events;
create policy "match_events_select_public"
  on public.match_events for select
  using (true);

-- Service role bypasses RLS; anon/authenticated can read with the policies above.

-- Optional: stats-only player rows before Discord link
do $$
begin
  if to_regclass('public.players') is not null then
    alter table public.players
      add column if not exists player_source text not null default 'discord';

    -- Allow pre-Discord archive rows (RoVer will merge when the same Roblox ID verifies)
    begin
      alter table public.players alter column discord_id drop not null;
    exception
      when others then null;
    end;
  end if;
end $$;
