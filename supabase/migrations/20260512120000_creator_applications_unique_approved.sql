-- One approved creator application per Discord account and per Roblox account.
-- Existing duplicates are removed, keeping the row with latest approved_at (then updated_at, created_at).

WITH ranked AS (
  SELECT id,
    ROW_NUMBER() OVER (
      PARTITION BY discord_id
      ORDER BY approved_at DESC NULLS LAST, updated_at DESC NULLS LAST, created_at DESC
    ) AS rn
  FROM public.creator_applications
  WHERE status = 'approved'
)
DELETE FROM public.creator_applications ca
USING ranked r
WHERE ca.id = r.id AND r.rn > 1;

WITH ranked AS (
  SELECT id,
    ROW_NUMBER() OVER (
      PARTITION BY roblox_id
      ORDER BY approved_at DESC NULLS LAST, updated_at DESC NULLS LAST, created_at DESC
    ) AS rn
  FROM public.creator_applications
  WHERE status = 'approved'
)
DELETE FROM public.creator_applications ca
USING ranked r
WHERE ca.id = r.id AND r.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS creator_applications_one_approved_per_discord
  ON public.creator_applications (discord_id)
  WHERE (status = 'approved');

CREATE UNIQUE INDEX IF NOT EXISTS creator_applications_one_approved_per_roblox
  ON public.creator_applications (roblox_id)
  WHERE (status = 'approved');
