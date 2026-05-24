-- Fixture assignment posts for referees (claim flow).

create table if not exists public.referee_assignments (
  id uuid primary key default gen_random_uuid(),
  guild_id text not null,
  channel_id text,
  message_id text,
  season smallint not null,
  competition text not null,
  game_week_label text,
  home_team_name text not null,
  away_team_name text not null,
  kickoff_label text,
  posted_by_discord_id text not null,
  posted_by_discord_tag text,
  status text not null default 'open'
    constraint referee_assignments_status_check
      check (status in ('open', 'claimed', 'cancelled', 'completed')),
  referee_id uuid references public.referees (id) on delete set null,
  claimed_by_discord_id text,
  claimed_at timestamptz,
  match_id text references public.matches (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists referee_assignments_open_guild_idx
  on public.referee_assignments (guild_id, status)
  where status = 'open';

create index if not exists referee_assignments_referee_idx
  on public.referee_assignments (referee_id)
  where referee_id is not null;

comment on table public.referee_assignments is
  'Discord /ref-post — staff post fixtures; active referees claim one match each.';

alter table public.referee_assignments enable row level security;

drop policy if exists "referee_assignments_select_public" on public.referee_assignments;
create policy "referee_assignments_select_public"
  on public.referee_assignments for select
  using (true);