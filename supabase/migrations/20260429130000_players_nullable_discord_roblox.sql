-- Stats/archive rows can exist before Discord link or Roblox ID is known.
alter table public.players alter column discord_id drop not null;
alter table public.players alter column roblox_user_id drop not null;
