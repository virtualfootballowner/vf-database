-- Tracks 24h / 1h fixture reminder DMs sent to club managers.

create table if not exists public.match_manager_fixture_reminders (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches (id) on delete cascade,
  manager_discord_id text not null,
  reminder_kind text not null
    constraint match_manager_fixture_reminders_kind_check
    check (reminder_kind in ('24h', '1h')),
  sent_at timestamptz not null default now(),
  constraint match_manager_fixture_reminders_unique
    unique (match_id, manager_discord_id, reminder_kind)
);

create index if not exists match_manager_fixture_reminders_match_idx
  on public.match_manager_fixture_reminders (match_id);

comment on table public.match_manager_fixture_reminders is
  'Discord fixture reminder DMs — one 24h and one 1h row per manager per match.';

alter table public.match_manager_fixture_reminders enable row level security;
