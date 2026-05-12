-- VF Create: competition / directory posts linked from Discord `/posted`.

ALTER TABLE public.creator_applications
  ADD COLUMN IF NOT EXISTS posted_video_links jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.creator_applications.posted_video_links IS
  'Creator-submitted post URLs: [{ "url": "https://...", "posted_at": "ISO-8601" }].';
