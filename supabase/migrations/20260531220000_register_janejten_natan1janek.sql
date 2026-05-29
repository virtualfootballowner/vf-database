-- Manual register: Discord janejten + Roblox natan1janek (885827007).
-- Removes wrong link (natan1janek was on kapasznikov's Discord).
-- discord_id stays null until janejten completes website /verify (player-sync merges it).

delete from public.players
where roblox_user_id = '885827007'
   or lower(btrim(roblox_username)) = lower('natan1janek')
   or lower(btrim(discord_username)) in (lower('janejten'), lower('janejten.'));

insert into public.players (
  roblox_username,
  roblox_user_id,
  discord_username,
  position
)
select
  'natan1janek',
  '885827007',
  'janejten.',
  'GK'
where not exists (
  select 1
  from public.players p
  where p.roblox_user_id = '885827007'
);
