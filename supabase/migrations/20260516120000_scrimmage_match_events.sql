-- =============================================================
-- VF FACEIT — In-game event ingestion (Roblox → web)
-- =============================================================
-- Adds the persistence layer for live scrim events posted from the
-- Roblox game server: goals, assists, cards, MOTM, plus the
-- `match.start` / `match.end` lifecycle events that link a Roblox
-- session to a SCR-### match started in Discord.
--
-- The host links the in-game match by typing `:start match SCR-XXXX`
-- in Roblox; the Roblox server posts a `match.start` event to
-- POST /api/scrimmage/events with the match_code. From that moment
-- on, every event for the same job is tagged to that match.
--
-- Event ingestion is intentionally schemaless on purpose-specific
-- payload (event_type + flexible `details` jsonb) so the Roblox dev
-- can ship new event kinds without a DB migration.
-- =============================================================

alter table public.scrimmage_matches
  add column if not exists roblox_place_id text,
  add column if not exists roblox_job_id text,
  add column if not exists roblox_started_at timestamptz,
  add column if not exists roblox_ended_at timestamptz;

create index if not exists scrimmage_matches_roblox_job_idx
  on public.scrimmage_matches (roblox_job_id)
  where roblox_job_id is not null;

comment on column public.scrimmage_matches.roblox_place_id is
  'Roblox placeId set when the host runs `:start match` in-game; null until linked.';
comment on column public.scrimmage_matches.roblox_job_id is
  'Roblox jobId for the live server. Used to dedupe linkage across reconnects.';

create table if not exists public.scrimmage_match_events (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.scrimmage_matches(id) on delete cascade,
  /** Resolved player when we can match roblox_user_id → players row. Null otherwise (still keep the event). */
  player_id uuid references public.players(id) on delete set null,
  /** Raw Roblox userId of the actor (always present, even when player_id is null). */
  roblox_user_id text not null,
  /**
   * One of: match_start, match_end, kickoff, halftime, fulltime,
   *         goal, own_goal, assist, yellow_card, red_card, motm,
   *         save, sub_in, sub_out, other.
   * Free-text on purpose so the Roblox dev can extend without a migration.
   */
  event_type text not null,
  /** In-game minute (1..120 typical). Optional — match_start/match_end won't have it. */
  minute integer,
  /**
   * Free-form payload from Roblox: assist_roblox_user_id, body part,
   * shot type, distance, x/y coords, etc. Keep all original context
   * here so we can re-derive stats later.
   */
  details jsonb not null default '{}'::jsonb,
  /** Original event timestamp from Roblox (server clock). Falls back to created_at. */
  occurred_at timestamptz,
  /** Roblox-side unique id for THIS event — used for idempotent retries. */
  external_event_id text,
  source text not null default 'roblox',
  created_at timestamptz not null default now()
);

create index if not exists scrimmage_match_events_match_idx
  on public.scrimmage_match_events (match_id, occurred_at);
create index if not exists scrimmage_match_events_player_idx
  on public.scrimmage_match_events (player_id)
  where player_id is not null;
create index if not exists scrimmage_match_events_roblox_user_idx
  on public.scrimmage_match_events (roblox_user_id);
create index if not exists scrimmage_match_events_type_idx
  on public.scrimmage_match_events (match_id, event_type);

-- Idempotency: same (match, external_event_id) is inserted at most once.
-- A single in-game event retried by the Roblox client is a no-op.
create unique index if not exists scrimmage_match_events_external_unique
  on public.scrimmage_match_events (match_id, external_event_id)
  where external_event_id is not null;

comment on table public.scrimmage_match_events is
  'In-game event log for FACEIT scrims, posted from Roblox via /api/scrimmage/events. event_type is free-text; see docs/roblox-scrimmage-events.md for the canonical list.';
