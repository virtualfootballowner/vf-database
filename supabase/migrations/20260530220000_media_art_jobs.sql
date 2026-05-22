-- VF Media art jobs: reporters post briefs; one GFX artist claims each job via Discord button.

create table if not exists public.media_art_jobs (
  id uuid primary key default gen_random_uuid(),
  guild_id text not null,
  channel_id text,
  message_id text,
  posted_by_discord_id text not null,
  posted_by_discord_tag text,
  description text not null,
  reference_image_url text not null,
  status text not null default 'open'
    constraint media_art_jobs_status_check
      check (status in ('open', 'claimed', 'cancelled')),
  claimed_by_discord_id text,
  claimed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists media_art_jobs_open_guild_idx
  on public.media_art_jobs (guild_id, status)
  where status = 'open';

comment on table public.media_art_jobs is
  'Discord /job flow — reporters post art briefs; GFX artists claim one job each.';

alter table public.media_art_jobs enable row level security;

drop policy if exists "media_art_jobs_select_public" on public.media_art_jobs;
create policy "media_art_jobs_select_public"
  on public.media_art_jobs for select
  using (true);
