-- Fix natan1janek Discord username (trailing dot: janejten.).

update public.players
set discord_username = 'janejten.'
where roblox_user_id = '885827007';
