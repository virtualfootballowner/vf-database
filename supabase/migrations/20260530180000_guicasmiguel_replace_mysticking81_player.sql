-- Discord 1494721135210659992: remove alt MysticKing81 player row; insert main Guicasmiguel.
-- (roblox_user_id is immutable once set — cannot UPDATE in place.)

delete from public.players
where discord_id = '1494721135210659992'
  and lower(btrim(roblox_username)) = lower('MysticKing81');

insert into public.players (
  roblox_username,
  roblox_user_id,
  discord_id,
  discord_username
)
select
  'Guicasmiguel',
  '886224606',
  '1494721135210659992',
  'Guicasmiguel'
where not exists (
  select 1
  from public.players p
  where p.discord_id = '1494721135210659992'
     or p.roblox_user_id = '886224606'
);
