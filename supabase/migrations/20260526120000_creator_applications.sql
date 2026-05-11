-- Creator program applications (isolated from league `players`; same person may also have a player row).

CREATE TYPE public.creator_application_status AS ENUM (
  'draft',
  'pending',
  'approved',
  'rejected'
);

CREATE TABLE public.creator_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  discord_id TEXT NOT NULL,
  discord_username TEXT,
  discord_avatar_url TEXT,
  roblox_id TEXT NOT NULL,
  roblox_username TEXT NOT NULL,
  roblox_avatar_url TEXT,
  tiktok_handle TEXT,
  youtube_handle TEXT,
  age INTEGER,
  country TEXT,
  email TEXT,
  rules_accepted_at TIMESTAMPTZ,
  expectations_accepted_at TIMESTAMPTZ,
  status public.creator_application_status NOT NULL DEFAULT 'draft',
  approved_by TEXT,
  approved_at TIMESTAMPTZ,
  rejection_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT creator_applications_age CHECK (age IS NULL OR age >= 13)
);

CREATE UNIQUE INDEX creator_applications_one_open_per_discord
  ON public.creator_applications (discord_id)
  WHERE status IN ('draft', 'pending');

CREATE UNIQUE INDEX creator_applications_one_open_per_roblox
  ON public.creator_applications (roblox_id)
  WHERE status IN ('draft', 'pending');

CREATE INDEX creator_applications_status_idx
  ON public.creator_applications (status);

CREATE INDEX creator_applications_created_at_idx
  ON public.creator_applications (created_at DESC);

ALTER TABLE public.creator_applications ENABLE ROW LEVEL SECURITY;

CREATE POLICY creator_applications_deny_anon
  ON public.creator_applications
  FOR ALL
  TO anon
  USING (false)
  WITH CHECK (false);

CREATE POLICY creator_applications_deny_authenticated
  ON public.creator_applications
  FOR ALL
  TO authenticated
  USING (false)
  WITH CHECK (false);
