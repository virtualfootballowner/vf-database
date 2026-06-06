-- Tracks match-result embeds posted to the public VF League results channel.

create table if not exists public.match_results_channel_alerts (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches (id) on delete cascade,
  channel_id text not null,
  discord_message_id text,
  sent_at timestamptz not null default now(),
  constraint match_results_channel_alerts_unique unique (match_id, channel_id)
);

create index if not exists match_results_channel_alerts_match_idx
  on public.match_results_channel_alerts (match_id);

comment on table public.match_results_channel_alerts is
  'Discord #results embeds for completed league fixtures — one row per match per channel.';

alter table public.match_results_channel_alerts enable row level security;

grant all on table public.match_results_channel_alerts to service_role;

drop policy if exists "match_results_alerts_service_all"
  on public.match_results_channel_alerts;

create policy "match_results_alerts_service_all"
  on public.match_results_channel_alerts
  for all
  to service_role
  using (true)
  with check (true);
