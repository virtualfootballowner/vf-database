-- Track main VF Discord guild bans on linked player rows for the public site.

alter table public.players
  add column if not exists discord_banned_at timestamptz null,
  add column if not exists discord_ban_reason text null;

comment on column public.players.discord_banned_at is
  'Set when the linked Discord account is banned from the VF league guild; cleared on unban.';
comment on column public.players.discord_ban_reason is
  'Optional ban reason from Discord; may be null.';
