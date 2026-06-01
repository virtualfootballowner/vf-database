-- Main referee + linesman slots per fixture assignment.

alter table public.referee_assignments
  add column if not exists main_referee_id uuid references public.referees (id) on delete set null,
  add column if not exists main_claimed_by_discord_id text,
  add column if not exists main_claimed_at timestamptz,
  add column if not exists linesman_referee_id uuid references public.referees (id) on delete set null,
  add column if not exists linesman_claimed_by_discord_id text,
  add column if not exists linesman_claimed_at timestamptz;

update public.referee_assignments
set
  main_referee_id = referee_id,
  main_claimed_by_discord_id = claimed_by_discord_id,
  main_claimed_at = claimed_at
where claimed_by_discord_id is not null
  and main_claimed_by_discord_id is null;

comment on column public.referee_assignments.main_claimed_by_discord_id is
  'Discord user claiming the main referee slot.';
comment on column public.referee_assignments.linesman_claimed_by_discord_id is
  'Discord user claiming the linesman slot.';
