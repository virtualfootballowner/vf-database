-- Allow first-time linking: NULL -> discord_id / NULL -> roblox_user_id.
-- Still forbid changing either column once it is already set (prevents account swaps).
create or replace function public.enforce_player_identity_lock()
returns trigger
language plpgsql
set search_path to public, pg_temp
as $function$
begin
  if tg_op = 'UPDATE' then
    if old.discord_id is not null
       and new.discord_id is distinct from old.discord_id then
      raise exception 'discord_id is immutable once linked';
    end if;

    if old.roblox_user_id is not null
       and new.roblox_user_id is distinct from old.roblox_user_id then
      raise exception 'roblox_user_id is immutable once linked';
    end if;
  end if;

  return new;
end;
$function$;
