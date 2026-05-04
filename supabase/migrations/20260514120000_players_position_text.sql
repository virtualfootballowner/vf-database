-- /contract uses fine-grained position codes (CB, WB, CDM, CM, CAM, ST, LW, RW)
-- but players.position was an enum (player_position) limited to GK/DEF/MID/FWD,
-- which made every contract approval fail with: invalid input value for enum player_position.
-- Switch the column to text (the bot already validates values via slash command choices)
-- and drop the now-unused enum.
alter table public.players
  alter column position type text using position::text;

drop type if exists public.player_position;

comment on column public.players.position is
  'Tactical position for the site profile (e.g. CB, WB, CDM, CM, CAM, ST, LW, RW). '
  'Updated when a player approves a /contract; bot validates the input.';
