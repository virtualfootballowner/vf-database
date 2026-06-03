-- Fixture assignment posts for VF Media (streamer + commentator claim flow).

create table if not exists public.media_assignments (
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
    constraint media_assignments_status_check
      check (status in ('open', 'claimed', 'cancelled', 'completed')),
  streamer_claimed_by_discord_id text,
  streamer_claimed_at timestamptz,
  streamer_display_name text,
  commentator_claimed_by_discord_id text,
  commentator_claimed_at timestamptz,
  commentator_display_name text,
  match_id uuid references public.matches (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists media_assignments_open_guild_idx
  on public.media_assignments (guild_id, status)
  where status = 'open';

create index if not exists media_assignments_match_idx
  on public.media_assignments (match_id)
  where match_id is not null;

comment on table public.media_assignments is
  'Discord /media-fixtures — staff post fixtures; streamers and commentators claim slots.';

alter table public.media_assignments enable row level security;

drop policy if exists "media_assignments_select_public" on public.media_assignments;
create policy "media_assignments_select_public"
  on public.media_assignments for select
  using (true);
