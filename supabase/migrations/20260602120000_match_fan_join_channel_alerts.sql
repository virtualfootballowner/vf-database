-- Tracks 10-minute fan join alerts posted to league / media Discord channels.

create table if not exists public.match_fan_join_channel_alerts (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches (id) on delete cascade,
  channel_id text not null,
  sent_at timestamptz not null default now(),
  constraint match_fan_join_channel_alerts_unique unique (match_id, channel_id)
);

create index if not exists match_fan_join_channel_alerts_match_idx
  on public.match_fan_join_channel_alerts (match_id);

comment on table public.match_fan_join_channel_alerts is
  'Discord channel posts 10 minutes before scheduled kickoff — one row per match per channel.';

alter table public.match_fan_join_channel_alerts enable row level security;
