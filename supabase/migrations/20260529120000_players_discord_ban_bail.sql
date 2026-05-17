-- Optional bail amount set via /ban; cleared when ban lifts.

ALTER TABLE public.players
  ADD COLUMN IF NOT EXISTS discord_ban_bail_amount NUMERIC(14, 2);

COMMENT ON COLUMN public.players.discord_ban_bail_amount IS
  'When set with an active league Discord ban, staff-defined bail; user is directed to tickets. Null = no bail.';
