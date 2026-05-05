-- =============================================================
-- VF FACEIT — Competitive Scrimmage System (foundation)
-- =============================================================
-- Pickup-style match system run from the Discord bot. Players queue,
-- captains draft teams (snake), match is played in Roblox, the winning
-- captain reports the score, and ELO updates apply on confirmation.
--
-- This migration creates the persistence layer only — the queue/draft/
-- ready/result state machine is in src/bot/scrimmage. ELO seeds at 1000.
--
-- Three tables:
--   scrimmage_ratings  — one row per player (rating, W/L/D, peak, AFK, ban)
--   scrimmage_matches  — one row per match (status, scores, captains, ts)
--   scrimmage_players  — match ↔ player join (team, pick order, ELO delta)
--
-- The legacy `matches` / `match_events` tables are intentionally NOT
-- touched — scrimmages are tagged in their own tables and never feed
-- into league standings or `players.goals_total`.
-- =============================================================

create table if not exists public.scrimmage_ratings (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null unique references public.players(id) on delete cascade,
  elo integer not null default 1000,
  wins integer not null default 0,
  losses integer not null default 0,
  draws integer not null default 0,
  games_played integer not null default 0,
  peak_elo integer not null default 1000,
  /** Positive = active win streak; negative = active loss streak; 0 = last game was a draw or no games yet. */
  current_streak integer not null default 0,
  afk_count integer not null default 0,
  /** Null = not banned. Set in the future when the bot enforces escalating bans. */
  ban_until timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists scrimmage_ratings_elo_desc_idx
  on public.scrimmage_ratings (elo desc);
create index if not exists scrimmage_ratings_ban_until_idx
  on public.scrimmage_ratings (ban_until);

comment on table public.scrimmage_ratings is
  'Per-player scrimmage ELO + W/L/D + AFK / ban state. Separate from league stats.';

create table if not exists public.scrimmage_matches (
  id uuid primary key default gen_random_uuid(),
  /** Human-readable code, e.g. SCR-2026-0142 (year + zero-padded sequence). */
  match_code varchar(20) not null unique,
  host_player_id uuid references public.players(id) on delete set null,
  team1_captain_id uuid references public.players(id) on delete set null,
  team2_captain_id uuid references public.players(id) on delete set null,
  team1_avg_elo integer,
  team2_avg_elo integer,
  team1_score integer,
  team2_score integer,
  player_count integer,
  /** queuing | drafting | ready_check | live | pending_confirmation | disputed | completed | cancelled | voided */
  status varchar(24) not null default 'queuing',
  /** Captain who submitted the result (one of the team captains). */
  reported_by uuid references public.players(id) on delete set null,
  /** Opposing captain who confirmed (or null if auto-accepted / disputed / admin override). */
  confirmed_by uuid references public.players(id) on delete set null,
  /** Discord message + channel for the lobby card so we can edit it after each phase. */
  lobby_message_id varchar(30),
  lobby_channel_id varchar(30),
  /** Lifecycle timestamps — null until that phase fires. */
  queue_started_at timestamptz not null default now(),
  draft_started_at timestamptz,
  match_started_at timestamptz,
  result_reported_at timestamptz,
  result_confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists scrimmage_matches_status_idx
  on public.scrimmage_matches (status);
create index if not exists scrimmage_matches_queue_started_idx
  on public.scrimmage_matches (queue_started_at desc);

comment on table public.scrimmage_matches is
  'Per-scrimmage match record. Status drives the bot state machine; ELO delta is applied to scrimmage_players + scrimmage_ratings on completion.';

create table if not exists public.scrimmage_players (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.scrimmage_matches(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  /** 1 or 2. Captains carry their own row with `is_captain = true`. */
  team smallint not null check (team in (1, 2)),
  /** Draft pick order (1 = first non-captain pick). Null for captains. */
  pick_order integer,
  is_captain boolean not null default false,
  preferred_position text,
  elo_before integer not null,
  elo_after integer,
  elo_change integer,
  is_afk boolean not null default false,
  readied_up boolean not null default false,
  ready_at timestamptz,
  created_at timestamptz not null default now(),
  unique (match_id, player_id)
);

create index if not exists scrimmage_players_match_idx
  on public.scrimmage_players (match_id);
create index if not exists scrimmage_players_player_idx
  on public.scrimmage_players (player_id);

comment on table public.scrimmage_players is
  'Match ↔ player join row. One row per participant per scrimmage; captains have is_captain = true and pick_order = null.';
