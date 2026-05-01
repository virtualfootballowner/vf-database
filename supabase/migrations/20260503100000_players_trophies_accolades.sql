-- Profile trophies (team honors) and accolades; merged by application scripts.
alter table public.players add column if not exists trophies jsonb not null default '[]'::jsonb;
alter table public.players add column if not exists accolades jsonb not null default '[]'::jsonb;

comment on column public.players.trophies is
  'JSON array: { title, season?, team? } — club championships and cups.';
comment on column public.players.accolades is
  'JSON array: { title, season?, meta? } — individual awards.';
