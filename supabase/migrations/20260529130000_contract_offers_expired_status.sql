-- Allow contract offers to expire when the signee does not respond in time.

ALTER TABLE public.contract_offers
  DROP CONSTRAINT IF EXISTS contract_offers_status_check;

ALTER TABLE public.contract_offers
  ADD CONSTRAINT contract_offers_status_check
  CHECK (
    status IN (
      'pending',
      'approved',
      'denied',
      'cancelled',
      'expired'
    )
  );

COMMENT ON COLUMN public.contract_offers.status IS
  'pending | approved | denied | cancelled | expired (auto after offer timeout).';

CREATE INDEX IF NOT EXISTS contract_offers_pending_created_at_idx
  ON public.contract_offers (created_at)
  WHERE status = 'pending';
