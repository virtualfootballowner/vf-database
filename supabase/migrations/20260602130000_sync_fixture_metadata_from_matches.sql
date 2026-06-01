-- Backfill fixture catalog metadata from linked match kickoffs (postponements update matches only).

update public.fixtures f
set
  metadata = coalesce(f.metadata, '{}'::jsonb)
    || jsonb_build_object(
      'scheduled_at', to_jsonb(m.scheduled_at::text),
      'calendar_date', to_jsonb(to_char(m.scheduled_at at time zone 'UTC', 'YYYY-MM-DD'))
    ),
  updated_at = now()
from public.matches m
where f.match_id = m.id
  and m.scheduled_at is not null;

update public.fixtures f
set
  metadata = coalesce(f.metadata, '{}'::jsonb)
    || jsonb_build_object(
      'scheduled_at', to_jsonb(m.scheduled_at::text),
      'calendar_date', to_jsonb(to_char(m.scheduled_at at time zone 'UTC', 'YYYY-MM-DD'))
    ),
  match_id = coalesce(f.match_id, m.id),
  updated_at = now()
from public.matches m
where f.roblox_match_id is not null
  and btrim(f.roblox_match_id) <> ''
  and m.roblox_match_id = f.roblox_match_id
  and m.scheduled_at is not null;
