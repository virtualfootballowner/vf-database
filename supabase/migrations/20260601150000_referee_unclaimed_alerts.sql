-- One channel alert per assignment when slots are still open 24h before kickoff.

create table if not exists public.referee_assignment_unclaimed_alerts (
  assignment_id uuid primary key references public.referee_assignments (id) on delete cascade,
  sent_at timestamptz not null default now()
);

comment on table public.referee_assignment_unclaimed_alerts is
  'Discord assignments channel — GAME NOT CLAIMED alert 24h before kickoff.';

alter table public.referee_assignment_unclaimed_alerts enable row level security;
