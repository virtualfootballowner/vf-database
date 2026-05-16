-- Tracks VF Create posting inactivity warnings (bot-scheduled 3-day warn / 8-day removal).

ALTER TABLE public.creator_applications
  ADD COLUMN IF NOT EXISTS posting_inactivity_warned_at TIMESTAMPTZ;

COMMENT ON COLUMN public.creator_applications.posting_inactivity_warned_at IS
  'Set when the bot warned an approved creator for no /posted link; cleared when they add a post.';
