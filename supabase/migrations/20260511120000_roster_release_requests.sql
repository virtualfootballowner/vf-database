-- Manager-initiated roster releases; staff approves in Discord (same channel as whitelist).
create table if not exists public.roster_release_requests (
  id uuid primary key default gen_random_uuid(),
  guild_id text not null,
  channel_id text,
  message_id text,
  requester_discord_id text not null,
  target_discord_id text not null,
  player_id uuid not null references public.players (id) on delete cascade,
  team_slug text not null,
  season smallint not null,
  reason text,
  status text not null default 'pending'
    constraint roster_release_requests_status_check
      check (status in ('pending', 'approved', 'denied')),
  staff_discord_id text,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create index if not exists roster_release_requests_pending_staff_idx
  on public.roster_release_requests (guild_id, status)
  where status = 'pending';

create unique index if not exists roster_release_requests_one_pending_per_slot
  on public.roster_release_requests (player_id, team_slug, season)
  where status = 'pending';

comment on table public.roster_release_requests is
  'Discord /release flow; staff with Manage Roles approve or deny removal from player_team_seasons.';

alter table public.roster_release_requests enable row level security;
