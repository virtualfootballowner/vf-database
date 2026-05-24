-- VF Referee server roster (Discord onboarding + assignments).

create table if not exists public.referees (
  id uuid primary key default gen_random_uuid(),
  discord_id text not null,
  discord_username text,
  roblox_user_id text,
  roblox_username text,
  status text not null default 'pending'
    constraint referees_status_check
      check (status in ('pending', 'active', 'denied', 'suspended', 'removed')),
  tier text,
  notes text,
  approved_by_discord_id text,
  approved_at timestamptz,
  denied_by_discord_id text,
  denied_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists referees_discord_id_unique
  on public.referees (discord_id);

create index if not exists referees_status_idx
  on public.referees (status);

comment on table public.referees is
  'VF Referee Discord server — applications, active roster, staff approve/deny.';

alter table public.referees enable row level security;

drop policy if exists "referees_select_public" on public.referees;
create policy "referees_select_public"
  on public.referees for select
  using (true);