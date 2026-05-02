-- Primary playing position on the public profile (sheet codes: ST, CB, …).
-- Kept in sync when a player approves a /contract offer.
alter table public.players add column if not exists position text;

comment on column public.players.position is
  'Tactical position for the site profile. Updated on contract approval; may be edited elsewhere.';
