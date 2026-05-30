-- Manual register: Discord playoffskinq + Roblox playoffskinq (43134643).

insert into public.players (
  roblox_username,
  roblox_user_id,
  discord_id,
  discord_username,
  verified_at
)
select
  'playoffskinq',
  '43134643',
  '525983700874428417',
  'playoffskinq',
  now()
where not exists (
  select 1
  from public.players p
  where p.roblox_user_id = '43134643'
     or p.discord_id = '525983700874428417'
);
