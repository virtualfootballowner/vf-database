-- Temporary Discord bans: auto-unban when discord_banned_until passes (bot job).
-- NULL discord_banned_until + discord_banned_at set = permanent until Discord unban / manual clear.

ALTER TABLE public.players
  ADD COLUMN IF NOT EXISTS discord_banned_until TIMESTAMPTZ;

COMMENT ON COLUMN public.players.discord_banned_until IS
  'When non-null and in the future, temp league Discord ban; bot unbans Discord + clears ban fields at/after this time. NULL with discord_banned_at set = permanent.';
