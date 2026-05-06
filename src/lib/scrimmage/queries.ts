/**
 * Web-side data layer for the FACEIT scrimmage system. Service-role
 * Supabase, mirrors the bot-side helpers in src/bot/scrimmage/db.ts.
 *
 * Kept in its own file so player profile / leaderboard / match pages can
 * share queries without dragging in any Discord-specific bot code.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import { createSupabaseServerClient } from "@/lib/supabase-server";

export const SCRIMMAGE_DEFAULT_ELO = 1000;

export type ScrimmageRating = {
  playerId: string;
  elo: number;
  peakElo: number;
  wins: number;
  losses: number;
  draws: number;
  gamesPlayed: number;
  currentStreak: number;
  afkCount: number;
  banUntil: string | null;
  rank: number | null;
};

export type ScrimmageRecentMatch = {
  matchCode: string;
  matchId: string;
  team: 1 | 2;
  isCaptain: boolean;
  isAfk: boolean;
  preferredPosition: string | null;
  eloBefore: number;
  eloAfter: number | null;
  eloChange: number | null;
  team1Score: number | null;
  team2Score: number | null;
  team1CaptainName: string | null;
  team2CaptainName: string | null;
  outcome: "win" | "loss" | "draw" | "pending";
  status: string;
  /** ISO8601 — match_started_at if present, else result_confirmed_at, else queue_started_at. */
  playedAt: string;
};

export type ScrimmageLeaderboardRow = {
  playerId: string;
  robloxUsername: string;
  elo: number;
  peakElo: number;
  wins: number;
  losses: number;
  draws: number;
  gamesPlayed: number;
  currentStreak: number;
  rank: number;
};

export type ScrimmageMatchPlayer = {
  playerId: string;
  robloxUsername: string;
  team: 1 | 2;
  pickOrder: number | null;
  isCaptain: boolean;
  isAfk: boolean;
  preferredPosition: string | null;
  eloBefore: number;
  eloAfter: number | null;
  eloChange: number | null;
};

export type ScrimmageMatchSummary = {
  matchCode: string;
  status: string;
  team1Score: number | null;
  team2Score: number | null;
  team1CaptainName: string | null;
  team2CaptainName: string | null;
  playerCount: number | null;
  /** Best wall-clock to display: result_confirmed_at → match_started_at → queue_started_at. */
  playedAt: string;
  /** True iff there's at least one match.start event for this match. */
  isLinkedToRoblox: boolean;
};

export type ScrimmageEvent = {
  id: string;
  matchId: string;
  playerId: string | null;
  robloxUserId: string;
  /** Resolved roblox_username when player_id matched a `players` row, else null. */
  robloxUsername: string | null;
  /** Team (1 or 2) for the actor, when their player_id is in the roster. */
  team: 1 | 2 | null;
  eventType: string;
  minute: number | null;
  details: Record<string, unknown>;
  occurredAt: string;
};

export type ScrimmageMatchDetail = {
  id: string;
  matchCode: string;
  status: string;
  team1Score: number | null;
  team2Score: number | null;
  team1AvgElo: number | null;
  team2AvgElo: number | null;
  playerCount: number | null;
  team1CaptainName: string | null;
  team2CaptainName: string | null;
  hostName: string | null;
  reportedByName: string | null;
  confirmedByName: string | null;
  queueStartedAt: string | null;
  matchStartedAt: string | null;
  resultConfirmedAt: string | null;
  /** Best wall-clock to display. */
  playedAt: string;
  team1: ScrimmageMatchPlayer[];
  team2: ScrimmageMatchPlayer[];
};

/** Resolve a player_id from a Roblox username (case-insensitive). */
export async function getPlayerIdByUsername(
  username: string,
): Promise<string | null> {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("players")
    .select("id")
    .ilike("roblox_username", username)
    .maybeSingle();
  if (error || !data) return null;
  return (data as { id: string }).id;
}

/* ------------------------------------------------------------------ */
/*  Per-player                                                         */
/* ------------------------------------------------------------------ */

export async function getScrimmageRating(
  playerId: string,
): Promise<ScrimmageRating | null> {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("scrimmage_ratings")
    .select(
      "player_id, elo, peak_elo, wins, losses, draws, games_played, current_streak, afk_count, ban_until",
    )
    .eq("player_id", playerId)
    .maybeSingle();
  if (error || !data) return null;

  const row = data as {
    player_id: string;
    elo: number;
    peak_elo: number;
    wins: number;
    losses: number;
    draws: number;
    games_played: number;
    current_streak: number;
    afk_count: number;
    ban_until: string | null;
  };

  // Compute global rank only if this player has actually played.
  let rank: number | null = null;
  if (row.games_played > 0) {
    const { count, error: rankErr } = await supabase
      .from("scrimmage_ratings")
      .select("player_id", { count: "exact", head: true })
      .gt("elo", row.elo);
    if (!rankErr && typeof count === "number") rank = count + 1;
  }

  return {
    playerId: row.player_id,
    elo: row.elo,
    peakElo: row.peak_elo,
    wins: row.wins,
    losses: row.losses,
    draws: row.draws,
    gamesPlayed: row.games_played,
    currentStreak: row.current_streak,
    afkCount: row.afk_count,
    banUntil: row.ban_until,
    rank,
  };
}

/**
 * Fetch the player's most recent N completed scrimmages with their team,
 * ELO Δ, opponent captain name, and the ISO8601 `playedAt`.
 */
export async function getRecentScrimmagesForPlayer(
  playerId: string,
  limit = 5,
): Promise<ScrimmageRecentMatch[]> {
  return await getScrimmagesForPlayerPaged({ playerId, limit, offset: 0 });
}

/**
 * Same as `getRecentScrimmagesForPlayer` but with offset for pagination on
 * the per-player history page.
 */
export async function getScrimmagesForPlayerPaged(args: {
  playerId: string;
  limit: number;
  offset: number;
}): Promise<ScrimmageRecentMatch[]> {
  const supabase = createSupabaseServerClient();

  // Step 1 — fetch all the player's scrimmage_players rows.
  const { data: pRows, error: pErr } = await supabase
    .from("scrimmage_players")
    .select(
      "match_id, team, is_captain, is_afk, preferred_position, elo_before, elo_after, elo_change",
    )
    .eq("player_id", args.playerId);
  if (pErr || !pRows || pRows.length === 0) return [];

  type PlayerRow = {
    match_id: string;
    team: 1 | 2;
    is_captain: boolean;
    is_afk: boolean;
    preferred_position: string | null;
    elo_before: number;
    elo_after: number | null;
    elo_change: number | null;
  };
  const playerRows = pRows as PlayerRow[];
  const matchIds = playerRows.map((r) => r.match_id);

  // Step 2 — fetch the matches themselves, completed only, ordered.
  const { data: mRows, error: mErr } = await supabase
    .from("scrimmage_matches")
    .select(
      "id, match_code, status, team1_score, team2_score, team1_captain_id, team2_captain_id, queue_started_at, match_started_at, result_confirmed_at",
    )
    .in("id", matchIds)
    .eq("status", "completed")
    .order("result_confirmed_at", { ascending: false })
    .range(args.offset, args.offset + args.limit - 1);
  if (mErr || !mRows) return [];

  type MatchRow = {
    id: string;
    match_code: string;
    status: string;
    team1_score: number | null;
    team2_score: number | null;
    team1_captain_id: string | null;
    team2_captain_id: string | null;
    queue_started_at: string | null;
    match_started_at: string | null;
    result_confirmed_at: string | null;
  };
  const matchRows = mRows as MatchRow[];

  // Step 3 — resolve captain names for each match.
  const captainIds = new Set<string>();
  for (const m of matchRows) {
    if (m.team1_captain_id) captainIds.add(m.team1_captain_id);
    if (m.team2_captain_id) captainIds.add(m.team2_captain_id);
  }
  const namesById = await fetchPlayerNamesByIds(supabase, [...captainIds]);

  const playerByMatch = new Map<string, PlayerRow>();
  for (const r of playerRows) playerByMatch.set(r.match_id, r);

  return matchRows.map((m) => {
    const p = playerByMatch.get(m.id)!;
    const t1 = m.team1_score ?? 0;
    const t2 = m.team2_score ?? 0;
    let outcome: ScrimmageRecentMatch["outcome"] = "pending";
    if (m.status === "completed" && m.team1_score != null && m.team2_score != null) {
      if (t1 === t2) outcome = "draw";
      else if ((p.team === 1 && t1 > t2) || (p.team === 2 && t2 > t1)) outcome = "win";
      else outcome = "loss";
    }
    return {
      matchCode: m.match_code,
      matchId: m.id,
      team: p.team,
      isCaptain: p.is_captain,
      isAfk: p.is_afk,
      preferredPosition: p.preferred_position,
      eloBefore: p.elo_before,
      eloAfter: p.elo_after,
      eloChange: p.elo_change,
      team1Score: m.team1_score,
      team2Score: m.team2_score,
      team1CaptainName:
        (m.team1_captain_id && namesById.get(m.team1_captain_id)) ?? null,
      team2CaptainName:
        (m.team2_captain_id && namesById.get(m.team2_captain_id)) ?? null,
      outcome,
      status: m.status,
      playedAt:
        m.result_confirmed_at ??
        m.match_started_at ??
        m.queue_started_at ??
        new Date(0).toISOString(),
    } satisfies ScrimmageRecentMatch;
  });
}

export async function countCompletedScrimmagesForPlayer(
  playerId: string,
): Promise<number> {
  const supabase = createSupabaseServerClient();

  // Two-step: get this player's match_ids, then count how many of those are completed.
  const { data: pRows, error: pErr } = await supabase
    .from("scrimmage_players")
    .select("match_id")
    .eq("player_id", playerId);
  if (pErr || !pRows || pRows.length === 0) return 0;

  const matchIds = (pRows as { match_id: string }[]).map((r) => r.match_id);
  const { count, error: cErr } = await supabase
    .from("scrimmage_matches")
    .select("id", { count: "exact", head: true })
    .in("id", matchIds)
    .eq("status", "completed");
  if (cErr) return 0;
  return count ?? 0;
}

/* ------------------------------------------------------------------ */
/*  Leaderboard                                                        */
/* ------------------------------------------------------------------ */

/**
 * Top N by ELO (with optional offset for pagination + optional username
 * filter). Only includes players who have actually played at least one
 * match — keeps the leaderboard meaningful (no 1000-ELO seed-only rows).
 */
export async function getScrimmageLeaderboard(args: {
  limit: number;
  offset: number;
  search?: string;
}): Promise<{ rows: ScrimmageLeaderboardRow[]; totalActive: number }> {
  const supabase = createSupabaseServerClient();

  // Total of "active" players (have actually played).
  const { count: totalActive } = await supabase
    .from("scrimmage_ratings")
    .select("player_id", { count: "exact", head: true })
    .gt("games_played", 0);

  // If there's a search, do it the cheap way: lookup matching player_ids
  // first, then filter the ratings query by those.
  let restrictPlayerIds: string[] | null = null;
  const search = args.search?.trim();
  if (search && search.length > 0) {
    const { data: matched, error: mErr } = await supabase
      .from("players")
      .select("id")
      .ilike("roblox_username", `%${search.replace(/[%_]/g, "")}%`)
      .limit(50);
    if (mErr) return { rows: [], totalActive: totalActive ?? 0 };
    restrictPlayerIds = ((matched ?? []) as { id: string }[]).map((r) => r.id);
    if (restrictPlayerIds.length === 0) {
      return { rows: [], totalActive: totalActive ?? 0 };
    }
  }

  let query = supabase
    .from("scrimmage_ratings")
    .select(
      "player_id, elo, peak_elo, wins, losses, draws, games_played, current_streak",
    )
    .gt("games_played", 0)
    .order("elo", { ascending: false })
    .order("games_played", { ascending: false });

  if (restrictPlayerIds) {
    query = query.in("player_id", restrictPlayerIds);
  }

  const { data, error } = await query.range(
    args.offset,
    args.offset + args.limit - 1,
  );
  if (error || !data) return { rows: [], totalActive: totalActive ?? 0 };

  type Row = {
    player_id: string;
    elo: number;
    peak_elo: number;
    wins: number;
    losses: number;
    draws: number;
    games_played: number;
    current_streak: number;
  };
  const rows = data as Row[];
  if (rows.length === 0) return { rows: [], totalActive: totalActive ?? 0 };

  const namesById = await fetchPlayerNamesByIds(
    supabase,
    rows.map((r) => r.player_id),
  );

  return {
    rows: rows.map((row, idx) => ({
      playerId: row.player_id,
      robloxUsername: namesById.get(row.player_id) ?? "Unknown",
      elo: row.elo,
      peakElo: row.peak_elo,
      wins: row.wins,
      losses: row.losses,
      draws: row.draws,
      gamesPlayed: row.games_played,
      currentStreak: row.current_streak,
      // Approximate rank — only correct for the first page when no search.
      rank: args.offset + idx + 1,
    })),
    totalActive: totalActive ?? 0,
  };
}

/* ------------------------------------------------------------------ */
/*  Single match                                                       */
/* ------------------------------------------------------------------ */

export async function getScrimmageMatchByCode(
  matchCode: string,
): Promise<ScrimmageMatchDetail | null> {
  const supabase = createSupabaseServerClient();

  const { data: matchRow, error: mErr } = await supabase
    .from("scrimmage_matches")
    .select(
      "id, match_code, status, team1_score, team2_score, team1_avg_elo, team2_avg_elo, player_count, team1_captain_id, team2_captain_id, host_player_id, reported_by, confirmed_by, queue_started_at, match_started_at, result_confirmed_at",
    )
    .eq("match_code", matchCode)
    .maybeSingle();
  if (mErr || !matchRow) return null;

  const m = matchRow as {
    id: string;
    match_code: string;
    status: string;
    team1_score: number | null;
    team2_score: number | null;
    team1_avg_elo: number | null;
    team2_avg_elo: number | null;
    player_count: number | null;
    team1_captain_id: string | null;
    team2_captain_id: string | null;
    host_player_id: string | null;
    reported_by: string | null;
    confirmed_by: string | null;
    queue_started_at: string | null;
    match_started_at: string | null;
    result_confirmed_at: string | null;
  };

  const { data: playerRows, error: pErr } = await supabase
    .from("scrimmage_players")
    .select(
      "player_id, team, pick_order, is_captain, is_afk, preferred_position, elo_before, elo_after, elo_change",
    )
    .eq("match_id", m.id);
  if (pErr) return null;

  type PlayerRow = {
    player_id: string;
    team: 1 | 2;
    pick_order: number | null;
    is_captain: boolean;
    is_afk: boolean;
    preferred_position: string | null;
    elo_before: number;
    elo_after: number | null;
    elo_change: number | null;
  };
  const players = (playerRows ?? []) as PlayerRow[];

  // Collect every player_id we need a username for (roster + meta refs).
  const allIds = new Set<string>();
  for (const p of players) allIds.add(p.player_id);
  for (const id of [
    m.team1_captain_id,
    m.team2_captain_id,
    m.host_player_id,
    m.reported_by,
    m.confirmed_by,
  ]) {
    if (id) allIds.add(id);
  }
  const namesById = await fetchPlayerNamesByIds(supabase, [...allIds]);

  const sortRoster = (team: 1 | 2): ScrimmageMatchPlayer[] =>
    players
      .filter((p) => p.team === team)
      .sort((a, b) => {
        if (a.is_captain !== b.is_captain) return a.is_captain ? -1 : 1;
        return (a.pick_order ?? 0) - (b.pick_order ?? 0);
      })
      .map((p) => ({
        playerId: p.player_id,
        robloxUsername: namesById.get(p.player_id) ?? "Unknown",
        team: p.team,
        pickOrder: p.pick_order,
        isCaptain: p.is_captain,
        isAfk: p.is_afk,
        preferredPosition: p.preferred_position,
        eloBefore: p.elo_before,
        eloAfter: p.elo_after,
        eloChange: p.elo_change,
      }));

  return {
    id: m.id,
    matchCode: m.match_code,
    status: m.status,
    team1Score: m.team1_score,
    team2Score: m.team2_score,
    team1AvgElo: m.team1_avg_elo,
    team2AvgElo: m.team2_avg_elo,
    playerCount: m.player_count,
    team1CaptainName:
      (m.team1_captain_id && namesById.get(m.team1_captain_id)) ?? null,
    team2CaptainName:
      (m.team2_captain_id && namesById.get(m.team2_captain_id)) ?? null,
    hostName: (m.host_player_id && namesById.get(m.host_player_id)) ?? null,
    reportedByName:
      (m.reported_by && namesById.get(m.reported_by)) ?? null,
    confirmedByName:
      (m.confirmed_by && namesById.get(m.confirmed_by)) ?? null,
    queueStartedAt: m.queue_started_at,
    matchStartedAt: m.match_started_at,
    resultConfirmedAt: m.result_confirmed_at,
    playedAt:
      m.result_confirmed_at ??
      m.match_started_at ??
      m.queue_started_at ??
      new Date(0).toISOString(),
    team1: sortRoster(1),
    team2: sortRoster(2),
  };
}

/* ------------------------------------------------------------------ */
/*  Recents (live + completed) for the FACEIT landing page             */
/* ------------------------------------------------------------------ */

const RECENTS_STATUSES = [
  "live",
  "pending_confirmation",
  "completed",
  "voided",
] as const;

export async function getRecentScrimmageMatches(
  limit = 6,
): Promise<ScrimmageMatchSummary[]> {
  const supabase = createSupabaseServerClient();

  // Pull from a slightly larger pool so live/pending bubble to the top
  // even when there are lots of completed matches.
  const { data, error } = await supabase
    .from("scrimmage_matches")
    .select(
      "id, match_code, status, team1_score, team2_score, player_count, team1_captain_id, team2_captain_id, queue_started_at, match_started_at, result_confirmed_at",
    )
    .in("status", RECENTS_STATUSES as unknown as string[])
    .order("queue_started_at", { ascending: false })
    .limit(Math.max(limit * 2, 12));
  if (error || !data) return [];

  type Row = {
    id: string;
    match_code: string;
    status: string;
    team1_score: number | null;
    team2_score: number | null;
    player_count: number | null;
    team1_captain_id: string | null;
    team2_captain_id: string | null;
    queue_started_at: string | null;
    match_started_at: string | null;
    result_confirmed_at: string | null;
  };
  const rows = data as Row[];
  if (rows.length === 0) return [];

  // Sort: live + pending first, then by latest activity desc.
  const statusRank = (s: string): number => {
    if (s === "live") return 0;
    if (s === "pending_confirmation") return 1;
    if (s === "completed") return 2;
    return 3;
  };
  rows.sort((a, b) => {
    const sr = statusRank(a.status) - statusRank(b.status);
    if (sr !== 0) return sr;
    const ta = a.result_confirmed_at ?? a.match_started_at ?? a.queue_started_at ?? "";
    const tb = b.result_confirmed_at ?? b.match_started_at ?? b.queue_started_at ?? "";
    return tb.localeCompare(ta);
  });
  const sliced = rows.slice(0, limit);

  // Resolve captain names + check which matches are linked to Roblox.
  const captainIds = new Set<string>();
  for (const r of sliced) {
    if (r.team1_captain_id) captainIds.add(r.team1_captain_id);
    if (r.team2_captain_id) captainIds.add(r.team2_captain_id);
  }
  const namesById = await fetchPlayerNamesByIds(supabase, [...captainIds]);

  // Find which of these matches have at least one match_start event.
  const matchIds = sliced.map((r) => r.id);
  const linkedMatchIds = new Set<string>();
  if (matchIds.length > 0) {
    const { data: linkRows } = await supabase
      .from("scrimmage_match_events")
      .select("match_id")
      .in("match_id", matchIds)
      .eq("event_type", "match_start");
    for (const row of (linkRows ?? []) as { match_id: string }[]) {
      linkedMatchIds.add(row.match_id);
    }
  }

  return sliced.map((r) => ({
    matchCode: r.match_code,
    status: r.status,
    team1Score: r.team1_score,
    team2Score: r.team2_score,
    team1CaptainName:
      (r.team1_captain_id && namesById.get(r.team1_captain_id)) ?? null,
    team2CaptainName:
      (r.team2_captain_id && namesById.get(r.team2_captain_id)) ?? null,
    playerCount: r.player_count,
    playedAt:
      r.result_confirmed_at ??
      r.match_started_at ??
      r.queue_started_at ??
      new Date(0).toISOString(),
    isLinkedToRoblox: linkedMatchIds.has(r.id),
  }));
}

/* ------------------------------------------------------------------ */
/*  In-game events for a single match                                  */
/* ------------------------------------------------------------------ */

export async function getScrimmageMatchEvents(
  matchId: string,
): Promise<ScrimmageEvent[]> {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("scrimmage_match_events")
    .select(
      "id, match_id, player_id, roblox_user_id, event_type, minute, details, occurred_at, created_at",
    )
    .eq("match_id", matchId)
    .order("occurred_at", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: true });
  if (error || !data) return [];

  type Row = {
    id: string;
    match_id: string;
    player_id: string | null;
    roblox_user_id: string;
    event_type: string;
    minute: number | null;
    details: Record<string, unknown> | null;
    occurred_at: string | null;
    created_at: string;
  };
  const rows = data as Row[];
  if (rows.length === 0) return [];

  // Pull team + name for any rostered player that fired an event.
  const playerIds = [...new Set(rows.map((r) => r.player_id).filter(Boolean) as string[])];
  let namesById = new Map<string, string>();
  const teamByPlayer = new Map<string, 1 | 2>();
  if (playerIds.length > 0) {
    namesById = await fetchPlayerNamesByIds(supabase, playerIds);
    const { data: rosterRows } = await supabase
      .from("scrimmage_players")
      .select("player_id, team")
      .eq("match_id", matchId)
      .in("player_id", playerIds);
    for (const r of (rosterRows ?? []) as { player_id: string; team: 1 | 2 }[]) {
      teamByPlayer.set(r.player_id, r.team);
    }
  }

  return rows.map((r) => ({
    id: r.id,
    matchId: r.match_id,
    playerId: r.player_id,
    robloxUserId: r.roblox_user_id,
    robloxUsername: r.player_id ? (namesById.get(r.player_id) ?? null) : null,
    team: r.player_id ? (teamByPlayer.get(r.player_id) ?? null) : null,
    eventType: r.event_type,
    minute: r.minute,
    details: (r.details ?? {}) as Record<string, unknown>,
    occurredAt: r.occurred_at ?? r.created_at,
  }));
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

async function fetchPlayerNamesByIds(
  supabase: SupabaseClient,
  playerIds: string[],
): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (playerIds.length === 0) return out;
  const { data, error } = await supabase
    .from("players")
    .select("id, roblox_username")
    .in("id", playerIds);
  if (error) return out;
  for (const row of (data ?? []) as {
    id: string;
    roblox_username: string | null;
  }[]) {
    if (row.roblox_username) out.set(row.id, row.roblox_username);
  }
  return out;
}
