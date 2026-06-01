-- DM assigned refs when a fixture is postponed; track keep / drop responses.

create table if not exists public.referee_postponement_responses (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.referee_assignments (id) on delete cascade,
  match_id uuid not null references public.matches (id) on delete cascade,
  discord_id text not null,
  slot text not null
    constraint referee_postponement_responses_slot_check
      check (slot in ('main', 'linesman')),
  new_scheduled_at timestamptz not null,
  status text not null default 'pending'
    constraint referee_postponement_responses_status_check
      check (status in ('pending', 'confirmed', 'declined')),
  dm_message_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint referee_postponement_responses_unique
    unique (assignment_id, slot, new_scheduled_at)
);

create index if not exists referee_postponement_responses_batch_idx
  on public.referee_postponement_responses (assignment_id, new_scheduled_at);

comment on table public.referee_postponement_responses is
  'Postponement DMs to assigned refs — confirm new kickoff or release slot for repost.';

alter table public.referee_postponement_responses enable row level security;
