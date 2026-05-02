-- Roster sheet fields from Discord /contract approvals
alter table public.player_team_seasons
  add column if not exists roster_position text,
  add column if not exists roster_role text;

comment on column public.player_team_seasons.roster_position is
  'Position agreed on contract (sheet / squad).';
comment on column public.player_team_seasons.roster_role is
  'Role from contract e.g. Captain, Starter.';

-- Pending contract cards (signee approve / deny)
create table if not exists public.contract_offers (
  id uuid primary key default gen_random_uuid(),
  guild_id text not null,
  channel_id text,
  message_id text,
  contractor_discord_id text not null,
  signee_discord_id text not null,
  team_slug text not null,
  season smallint not null default 3,
  roster_position text not null,
  roster_role text not null,
  signee_player_id uuid not null references public.players (id) on delete cascade,
  status text not null default 'pending'
    constraint contract_offers_status_check
      check (status in ('pending', 'approved', 'denied', 'cancelled')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create index if not exists contract_offers_pending_signee_idx
  on public.contract_offers (signee_discord_id)
  where status = 'pending';

create index if not exists contract_offers_team_season_idx
  on public.contract_offers (team_slug, season);

comment on table public.contract_offers is
  'Discord /contract flow; only the signee may approve or deny.';

alter table public.contract_offers enable row level security;
