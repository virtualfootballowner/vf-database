-- Season 3 World Cup · GW1–GW3 group fixtures (randomized draw, UTC kickoffs, stadium TBD).
-- Re-run `npm run db:seed:fixtures` to refresh from repo schedule source.

delete from public.match_events me
using public.matches m
where me.match_id = m.id
  and m.roblox_match_id like 'S3-WC-G-%';

delete from public.matches
where roblox_match_id like 'S3-WC-G-%';

-- Fixtures + scheduled matches are applied via seed-fixtures-assets.ts (service role).
-- This migration clears stale group rows so the seed can reload cleanly.

comment on table public.fixtures is
  'Season schedule & bracket slots. S3 GW1–GW3 group pairings seeded from s3-world-cup-group-schedule.ts.';
