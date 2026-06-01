-- Manager-initiated fixture postponements: opponent DM accept/deny, staff escalation.

create table if not exists public.match_postponement_state (
  match_id uuid primary key references public.matches (id) on delete cascade,
  denial_count integer not null default 0,
  denial_log jsonb not null default '[]'::jsonb,
  original_locked boolean not null default false,
  updated_at timestamptz not null default now()
);

comment on table public.match_postponement_state is
  'Per-match postponement denial tally and staff lock on original kickoff.';

create sequence if not exists public.match_postponement_case_number_seq;

create table if not exists public.match_postponement_requests (
  id uuid primary key default gen_random_uuid(),
  case_number bigint not null default nextval('public.match_postponement_case_number_seq'),
  match_id uuid not null references public.matches (id) on delete cascade,
  guild_id text not null,
  requester_discord_id text not null,
  opponent_discord_id text,
  requester_team_slug text not null,
  opponent_team_slug text not null,
  original_scheduled_at timestamptz not null,
  proposed_scheduled_at timestamptz not null,
  reason text not null,
  status text not null default 'pending_opponent'
    constraint match_postponement_requests_status_check check (
      status in (
        'pending_opponent',
        'accepted',
        'denied',
        'expired',
        'escalated',
        'staff_approved',
        'staff_force_original',
        'staff_set_time',
        'superseded'
      )
    ),
  opponent_dm_message_id text,
  requester_dm_message_id text,
  escalation_channel_id text,
  escalation_message_id text,
  staff_discord_id text,
  staff_resolved_at timestamptz,
  staff_set_scheduled_at timestamptz,
  expires_at timestamptz not null,
  staff_ping_due_at timestamptz,
  staff_last_ping_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists match_postponement_one_active_per_match
  on public.match_postponement_requests (match_id)
  where status in ('pending_opponent', 'escalated');

create index if not exists match_postponement_pending_expiry_idx
  on public.match_postponement_requests (expires_at)
  where status = 'pending_opponent';

create index if not exists match_postponement_escalated_ping_idx
  on public.match_postponement_requests (staff_ping_due_at)
  where status = 'escalated';

comment on table public.match_postponement_requests is
  'Discord /postpone flow — opponent accept/deny via DM, staff escalation after 3 denials or 48h silence.';

alter table public.match_postponement_state enable row level security;
alter table public.match_postponement_requests enable row level security;
