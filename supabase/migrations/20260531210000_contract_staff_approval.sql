-- Player accept → staff review before roster write.

alter table public.contract_offers
  drop constraint if exists contract_offers_status_check;

alter table public.contract_offers
  add constraint contract_offers_status_check
  check (
    status in (
      'pending',
      'accepted',
      'approved',
      'denied',
      'cancelled',
      'expired'
    )
  );

alter table public.contract_offers
  add column if not exists staff_review_channel_id text,
  add column if not exists staff_review_message_id text,
  add column if not exists staff_discord_id text,
  add column if not exists accepted_at timestamptz;

comment on column public.contract_offers.status is
  'pending (awaiting signee) | accepted (awaiting staff) | approved | denied | cancelled | expired';

create index if not exists contract_offers_accepted_staff_idx
  on public.contract_offers (guild_id, status)
  where status = 'accepted';
