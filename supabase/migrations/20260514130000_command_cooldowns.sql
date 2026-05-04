-- Per-user, per-command cooldowns enforced by the bot (e.g. /freeagent = 1 use / 6h).
-- Stored server-side so cooldowns survive bot restarts.
create table if not exists public.command_cooldowns (
  command text not null,
  user_id text not null,
  expires_at timestamptz not null,
  primary key (command, user_id)
);

create index if not exists command_cooldowns_expires_at_idx
  on public.command_cooldowns (expires_at);

comment on table public.command_cooldowns is
  'Bot slash command rate limits — one row per (command,user). Expired rows can be pruned.';
