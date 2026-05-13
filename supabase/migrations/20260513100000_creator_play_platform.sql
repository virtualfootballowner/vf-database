-- Primary Roblox platform (PC / mobile / console) on creator applications.

ALTER TABLE public.creator_applications
  ADD COLUMN IF NOT EXISTS play_platform TEXT;

ALTER TABLE public.creator_applications
  DROP CONSTRAINT IF EXISTS creator_applications_play_platform_valid;

ALTER TABLE public.creator_applications
  ADD CONSTRAINT creator_applications_play_platform_valid
    CHECK (
      play_platform IS NULL
      OR play_platform IN ('pc', 'mobile', 'console')
    );

COMMENT ON COLUMN public.creator_applications.play_platform IS
  'Where the creator mainly plays Roblox: pc, mobile, or console.';
