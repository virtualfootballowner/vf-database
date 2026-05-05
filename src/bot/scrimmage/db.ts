import type { SupabaseClient } from "@supabase/supabase-js";

import {
  computeScrimmageDeltas,
  SCRIMMAGE_DEFAULT_ELO,
} from "@/bot/scrimmage/elo";

/**
 * Database access layer for the scrimmage system. Every query in here is
 * service-role (admin) — RLS is bypassed because the bot is the only writer.
 */

export type ScrimmageRatingRow = {
  player_id: string;
  elo: number;
  wins: number;
  losses: number;
  draws: number;
  draws_total?: number;
  games_played: number;
  peak_elo: number;
  current_streak: number;
  afk_count: number;
  ban_until: string | null;
};

/**
 * Return the rating row for the player. If they don't have one yet, insert a
 * fresh row at the seed ELO and return it. Keeps callers branchless.
 */
export async function ensureScrimmageRating(
  supabase: SupabaseClient,
  playerId: string,
): Promise<ScrimmageRatingRow> {
  const { data: existing, error: fetchErr } = await supabase
    .from("scrimmage_ratings")
    .select(
      "player_id, elo, wins, losses, draws, games_played, peak_elo, current_streak, afk_count, ban_until",
    )
    .eq("player_id", playerId)
    .maybeSingle();
  if (fetchErr) throw fetchErr;
  if (existing) return existing as ScrimmageRatingRow;

  const seed: ScrimmageRatingRow = {
    player_id: playerId,
    elo: SCRIMMAGE_DEFAULT_ELO,
    wins: 0,
    losses: 0,
    draws: 0,
    games_played: 0,
    peak_elo: SCRIMMAGE_DEFAULT_ELO,
    current_streak: 0,
    afk_count: 0,
    ban_until: null,
  };
  const { error: insertErr } = await supabase
    .from("scrimmage_ratings")
    .insert(seed);
  if (insertErr) {
    // Race-condition guard: another insert may have won. Re-fetch and return.
    const { data: retry, error: retryErr } = await supabase
      .from("scrimmage_ratings")
      .select(
        "player_id, elo, wins, losses, draws, games_played, peak_elo, current_streak, afk_count, ban_until",
      )
      .eq("player_id", playerId)
      .maybeSingle();
    if (retryErr || !retry) throw insertErr;
    return retry as ScrimmageRatingRow;
  }
  return seed;
}

/** Bulk-fetch ratings for a set of player ids; missing rows seeded at default. */
export async function fetchRatingsForPlayers(
  supabase: SupabaseClient,
  playerIds: string[],
): Promise<Map<string, ScrimmageRatingRow>> {
  const out = new Map<string, ScrimmageRatingRow>();
  if (playerIds.length === 0) return out;
  const { data, error } = await supabase
    .from("scrimmage_ratings")
    .select(
      "player_id, elo, wins, losses, draws, games_played, peak_elo, current_streak, afk_count, ban_until",
    )
    .in("player_id", playerIds);
  if (error) throw error;
  for (const row of (data ?? []) as ScrimmageRatingRow[]) {
    out.set(row.player_id, row);
  }
  // Synthesize defaults for any missing — the caller may treat new players as 1000.
  for (const id of playerIds) {
    if (!out.has(id)) {
      out.set(id, {
        player_id: id,
        elo: SCRIMMAGE_DEFAULT_ELO,
        wins: 0,
        losses: 0,
        draws: 0,
        games_played: 0,
        peak_elo: SCRIMMAGE_DEFAULT_ELO,
        current_streak: 0,
        afk_count: 0,
        ban_until: null,
      });
    }
  }
  return out;
}

export type LeaderboardEntry = {
  player_id: string;
  roblox_username: string;
  elo: number;
  wins: number;
  losses: number;
  draws: number;
  games_played: number;
  peak_elo: number;
};

/**
 * Top N by ELO, plus `players.roblox_username` for display. Players who
 * have never queued won't appear (they only show up after their first match
 * via `ensureScrimmageRating`).
 *
 * Implementation note: we used to do this with an embedded Supabase join
 * (`players:player_id(roblox_username)`) but `scrimmage_ratings.player_id`
 * is a `UNIQUE` FK, so Supabase returns the relation as an object, not an
 * array. The previous code treated it as an array and silently fell back
 * to "Unknown" for every row. A two-step fetch is unambiguous + cheap.
 */
export async function fetchScrimmageLeaderboard(
  supabase: SupabaseClient,
  topN = 10,
): Promise<LeaderboardEntry[]> {
  const { data: ratings, error } = await supabase
    .from("scrimmage_ratings")
    .select(
      "player_id, elo, wins, losses, draws, games_played, peak_elo",
    )
    .order("elo", { ascending: false })
    .order("games_played", { ascending: false })
    .limit(topN);
  if (error) throw error;

  const rows = (ratings ?? []) as Omit<LeaderboardEntry, "roblox_username">[];
  if (rows.length === 0) return [];

  const names = await fetchPlayerNamesByIds(
    supabase,
    rows.map((r) => r.player_id),
  );

  return rows.map((row) => ({
    player_id: row.player_id,
    roblox_username: names.get(row.player_id) ?? "Unknown",
    elo: row.elo,
    wins: row.wins,
    losses: row.losses,
    draws: row.draws,
    games_played: row.games_played,
    peak_elo: row.peak_elo,
  }));
}

/**
 * Look up a single player's combined `players` profile + scrimmage rating
 * by their Discord ID. Returns null if no `players` row exists.
 */
export async function fetchScrimmageStatsForDiscord(
  supabase: SupabaseClient,
  discordId: string,
): Promise<
  | {
      player_id: string;
      roblox_username: string;
      rating: ScrimmageRatingRow;
      rank: number | null;
    }
  | null
> {
  const { data: profile, error: pErr } = await supabase
    .from("players")
    .select("id, roblox_username")
    .eq("discord_id", discordId)
    .maybeSingle();
  if (pErr) throw pErr;
  if (!profile) return null;
  const playerId = (profile as { id: string }).id;
  const robloxUsername =
    (profile as { roblox_username: string | null }).roblox_username ??
    "Unknown";

  // We don't insert a rating row on /scrimmage stats — only after the player
  // actually plays. So the row may not exist yet.
  const { data: rating, error: rErr } = await supabase
    .from("scrimmage_ratings")
    .select(
      "player_id, elo, wins, losses, draws, games_played, peak_elo, current_streak, afk_count, ban_until",
    )
    .eq("player_id", playerId)
    .maybeSingle();
  if (rErr) throw rErr;

  const ratingRow: ScrimmageRatingRow =
    (rating as ScrimmageRatingRow | null) ?? {
      player_id: playerId,
      elo: SCRIMMAGE_DEFAULT_ELO,
      wins: 0,
      losses: 0,
      draws: 0,
      games_played: 0,
      peak_elo: SCRIMMAGE_DEFAULT_ELO,
      current_streak: 0,
      afk_count: 0,
      ban_until: null,
    };

  // Compute global rank only if they actually have a row (otherwise rank is N/A).
  let rank: number | null = null;
  if (rating) {
    const { count, error: rankErr } = await supabase
      .from("scrimmage_ratings")
      .select("player_id", { count: "exact", head: true })
      .gt("elo", ratingRow.elo);
    if (!rankErr && typeof count === "number") {
      rank = count + 1;
    }
  }

  return {
    player_id: playerId,
    roblox_username: robloxUsername,
    rating: ratingRow,
    rank,
  };
}

/**
 * Number of completed scrimmage matches across all players (for footer info
 * on /leaderboard). Cheap — count(*) over an indexed status column.
 */
export async function countCompletedScrimmages(
  supabase: SupabaseClient,
): Promise<number> {
  const { count, error } = await supabase
    .from("scrimmage_matches")
    .select("id", { count: "exact", head: true })
    .eq("status", "completed");
  if (error) throw error;
  return count ?? 0;
}

/* ------------------------------------------------------------------ */
/*  Active-match queries used by the lobby/draft/match flow           */
/* ------------------------------------------------------------------ */

export type ScrimmageMatchStatus =
  | "queuing"
  | "drafting"
  | "ready_check"
  | "live"
  | "pending_confirmation"
  | "disputed"
  | "completed"
  | "cancelled"
  | "voided";

/**
 * One global active scrimmage at a time per spec ("Only one lobby at a
 * time"). Returns the row that's still in any of the pre-completion states.
 */
export async function fetchActiveScrimmageMatch(
  supabase: SupabaseClient,
): Promise<{ id: string; status: ScrimmageMatchStatus } | null> {
  const { data, error } = await supabase
    .from("scrimmage_matches")
    .select("id, status")
    .in("status", ["queuing", "drafting", "ready_check", "live", "pending_confirmation"])
    .order("queue_started_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return (data as { id: string; status: ScrimmageMatchStatus } | null) ?? null;
}

/**
 * Insert the seed match row at queue-start time. We intentionally don't
 * write any scrimmage_players rows yet — the queue is in-memory until the
 * draft assigns teams (the table's `team` constraint is `1 or 2`, so we
 * can't store unassigned players there).
 *
 * `match_code` is `NOT NULL` so we generate it at queue start. Cancelled
 * lobbies "burn" a code which inflates the counter slightly — purely
 * cosmetic, and far simpler than nullable code + later assignment.
 */
export async function createScrimmageMatch(
  supabase: SupabaseClient,
  args: {
    hostPlayerId: string;
    lobbyChannelId: string;
    lobbyMessageId: string | null;
  },
): Promise<{ id: string; matchCode: string }> {
  // Up to 3 retries on the (extremely rare) match_code race.
  let lastErr: unknown = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    const matchCode = await generateMatchCode(supabase);
    const { data, error } = await supabase
      .from("scrimmage_matches")
      .insert({
        match_code: matchCode,
        host_player_id: args.hostPlayerId,
        lobby_channel_id: args.lobbyChannelId,
        lobby_message_id: args.lobbyMessageId,
        status: "queuing",
      })
      .select("id, match_code")
      .single();
    if (!error && data) {
      return {
        id: (data as { id: string }).id,
        matchCode: (data as { match_code: string }).match_code,
      };
    }
    lastErr = error;
  }
  throw lastErr instanceof Error
    ? lastErr
    : new Error("Failed to insert scrimmage_matches row");
}

export async function setScrimmageMatchMessageId(
  supabase: SupabaseClient,
  matchId: string,
  messageId: string,
): Promise<void> {
  const { error } = await supabase
    .from("scrimmage_matches")
    .update({ lobby_message_id: messageId, updated_at: new Date().toISOString() })
    .eq("id", matchId);
  if (error) throw error;
}

export async function updateScrimmageMatchStatus(
  supabase: SupabaseClient,
  matchId: string,
  status: ScrimmageMatchStatus,
  patch: Record<string, unknown> = {},
): Promise<void> {
  const { error } = await supabase
    .from("scrimmage_matches")
    .update({ status, updated_at: new Date().toISOString(), ...patch })
    .eq("id", matchId);
  if (error) throw error;
}

/**
 * Insert a scrimmage_players row for a captain (no pick_order, is_captain=true).
 */
export async function insertCaptainPlayer(
  supabase: SupabaseClient,
  args: {
    matchId: string;
    playerId: string;
    team: 1 | 2;
    eloBefore: number;
    preferredPosition: string | null;
  },
): Promise<void> {
  const { error } = await supabase.from("scrimmage_players").insert({
    match_id: args.matchId,
    player_id: args.playerId,
    team: args.team,
    is_captain: true,
    elo_before: args.eloBefore,
    preferred_position: args.preferredPosition,
  });
  if (error) throw error;
}

/**
 * Insert a scrimmage_players row for a drafted (non-captain) player with the
 * given pick order.
 */
export async function insertDraftedPlayer(
  supabase: SupabaseClient,
  args: {
    matchId: string;
    playerId: string;
    team: 1 | 2;
    pickOrder: number;
    eloBefore: number;
    preferredPosition: string | null;
  },
): Promise<void> {
  const { error } = await supabase.from("scrimmage_players").insert({
    match_id: args.matchId,
    player_id: args.playerId,
    team: args.team,
    pick_order: args.pickOrder,
    is_captain: false,
    elo_before: args.eloBefore,
    preferred_position: args.preferredPosition,
  });
  if (error) throw error;
}

export type ScrimmagePlayerRow = {
  id: string;
  match_id: string;
  player_id: string;
  team: 1 | 2;
  pick_order: number | null;
  is_captain: boolean;
  preferred_position: string | null;
  elo_before: number;
  elo_after: number | null;
  elo_change: number | null;
  is_afk: boolean;
  readied_up: boolean;
};

export async function fetchMatchPlayers(
  supabase: SupabaseClient,
  matchId: string,
): Promise<ScrimmagePlayerRow[]> {
  const { data, error } = await supabase
    .from("scrimmage_players")
    .select(
      "id, match_id, player_id, team, pick_order, is_captain, preferred_position, elo_before, elo_after, elo_change, is_afk, readied_up",
    )
    .eq("match_id", matchId);
  if (error) throw error;
  return (data ?? []) as ScrimmagePlayerRow[];
}

/** Mark a single player as readied + record the timestamp. */
export async function markPlayerReady(
  supabase: SupabaseClient,
  matchId: string,
  playerId: string,
): Promise<void> {
  const { error } = await supabase
    .from("scrimmage_players")
    .update({ readied_up: true, ready_at: new Date().toISOString() })
    .eq("match_id", matchId)
    .eq("player_id", playerId);
  if (error) throw error;
}

/**
 * Delete a `scrimmage_players` row for a player who got benched during the
 * ready-check rebalance (no penalty — they readied up but their team was
 * larger and someone had to come off). Used in lieu of "row stays + flag"
 * because a benched player should be entirely outside the ELO accounting.
 */
export async function removeBenchedPlayer(
  supabase: SupabaseClient,
  args: { matchId: string; playerId: string },
): Promise<void> {
  const { error } = await supabase
    .from("scrimmage_players")
    .delete()
    .eq("match_id", args.matchId)
    .eq("player_id", args.playerId);
  if (error) throw error;
}

/**
 * Apply the -15 ELO no-show penalty to a player who failed the ready check.
 * Their scrimmage_players row gets is_afk=true, and their rating moves down
 * (peak unchanged). The match itself is then cancelled by the caller.
 */
export async function applyNoShowPenalty(
  supabase: SupabaseClient,
  args: { matchId: string; playerId: string; penalty: number },
): Promise<void> {
  const { error: pErr } = await supabase
    .from("scrimmage_players")
    .update({ is_afk: true })
    .eq("match_id", args.matchId)
    .eq("player_id", args.playerId);
  if (pErr) throw pErr;

  const { data: existing, error: rErr } = await supabase
    .from("scrimmage_ratings")
    .select("elo, afk_count")
    .eq("player_id", args.playerId)
    .maybeSingle();
  if (rErr) throw rErr;

  if (!existing) {
    const seedElo = SCRIMMAGE_DEFAULT_ELO + args.penalty;
    const { error: insErr } = await supabase
      .from("scrimmage_ratings")
      .insert({
        player_id: args.playerId,
        elo: seedElo,
        peak_elo: SCRIMMAGE_DEFAULT_ELO,
        afk_count: 1,
      });
    if (insErr) throw insErr;
    return;
  }

  const newElo =
    Number((existing as { elo: number }).elo) + args.penalty;
  const { error: upErr } = await supabase
    .from("scrimmage_ratings")
    .update({
      elo: newElo,
      afk_count:
        Number((existing as { afk_count: number }).afk_count) + 1,
      updated_at: new Date().toISOString(),
    })
    .eq("player_id", args.playerId);
  if (upErr) throw upErr;
}

/**
 * Generate the next match code in `SCR-YYYY-NNNN` format. Counts existing
 * non-cancelled matches in the calendar year and zero-pads to 4 digits.
 * Not strictly atomic — under simultaneous lobbies (which the singleton
 * gate already prevents) you could see duplicates, but the unique index
 * on `match_code` would just bounce the second insert and the caller
 * retries.
 */
export async function generateMatchCode(
  supabase: SupabaseClient,
): Promise<string> {
  const year = new Date().getUTCFullYear();
  const yearPrefix = `SCR-${year}-`;
  const { count, error } = await supabase
    .from("scrimmage_matches")
    .select("id", { count: "exact", head: true })
    .like("match_code", `${yearPrefix}%`);
  if (error) throw error;
  const next = (count ?? 0) + 1;
  return `${yearPrefix}${String(next).padStart(4, "0")}`;
}

export async function fetchScrimmageMatchByCode(
  supabase: SupabaseClient,
  matchCode: string,
): Promise<{
  id: string;
  match_code: string;
  status: ScrimmageMatchStatus;
  team1_captain_id: string | null;
  team2_captain_id: string | null;
  team1_score: number | null;
  team2_score: number | null;
  reported_by: string | null;
  lobby_channel_id: string | null;
  lobby_message_id: string | null;
} | null> {
  const { data, error } = await supabase
    .from("scrimmage_matches")
    .select(
      "id, match_code, status, team1_captain_id, team2_captain_id, team1_score, team2_score, reported_by, lobby_channel_id, lobby_message_id",
    )
    .eq("match_code", matchCode)
    .maybeSingle();
  if (error) throw error;
  return data as {
    id: string;
    match_code: string;
    status: ScrimmageMatchStatus;
    team1_captain_id: string | null;
    team2_captain_id: string | null;
    team1_score: number | null;
    team2_score: number | null;
    reported_by: string | null;
    lobby_channel_id: string | null;
    lobby_message_id: string | null;
  } | null;
}

/**
 * Apply the final result + per-player ELO deltas. Runs as a sequence of
 * updates because Supabase JS doesn't expose multi-row transactions —
 * scrimmage volume is low so the cost is fine. Returns the per-player
 * deltas for embed rendering.
 */
export async function applyScrimmageResult(
  supabase: SupabaseClient,
  args: {
    matchId: string;
    team1Score: number;
    team2Score: number;
    reportedBy: string | null;
    confirmedBy: string | null;
  },
): Promise<{
  team1Delta: number;
  team2Delta: number;
  team1Avg: number;
  team2Avg: number;
  perPlayer: {
    player_id: string;
    team: 1 | 2;
    elo_before: number;
    elo_after: number;
    delta: number;
  }[];
}> {
  const players = await fetchMatchPlayers(supabase, args.matchId);
  if (players.length === 0) {
    throw new Error("No players on this scrimmage — cannot apply result.");
  }

  const team1 = players
    .filter((p) => p.team === 1)
    .map((p) => ({ player_id: p.player_id, elo: p.elo_before }));
  const team2 = players
    .filter((p) => p.team === 2)
    .map((p) => ({ player_id: p.player_id, elo: p.elo_before }));

  const { team1Avg, team2Avg, team1Delta, team2Delta, perPlayer: deltaMap } =
    computeScrimmageDeltas({
      team1,
      team2,
      team1Score: args.team1Score,
      team2Score: args.team2Score,
    });

  const isDraw = args.team1Score === args.team2Score;
  const team1Won = args.team1Score > args.team2Score;

  const perPlayer: {
    player_id: string;
    team: 1 | 2;
    elo_before: number;
    elo_after: number;
    delta: number;
  }[] = [];

  for (const p of players) {
    const delta = deltaMap.get(p.player_id) ?? 0;
    const eloAfter = p.elo_before + delta;

    // Update player row
    {
      const { error } = await supabase
        .from("scrimmage_players")
        .update({
          elo_after: eloAfter,
          elo_change: delta,
        })
        .eq("id", p.id);
      if (error) throw error;
    }

    // Resolve outcome for this player
    let outcome: "win" | "loss" | "draw";
    if (isDraw) outcome = "draw";
    else if ((p.team === 1 && team1Won) || (p.team === 2 && !team1Won))
      outcome = "win";
    else outcome = "loss";

    // Upsert rating row
    const { data: rating, error: rErr } = await supabase
      .from("scrimmage_ratings")
      .select("elo, peak_elo, current_streak, wins, losses, draws, games_played, afk_count, ban_until")
      .eq("player_id", p.player_id)
      .maybeSingle();
    if (rErr) throw rErr;

    const baseElo = rating
      ? Number((rating as { elo: number }).elo)
      : SCRIMMAGE_DEFAULT_ELO;
    const newElo = baseElo + delta;
    const peakBefore = rating
      ? Number((rating as { peak_elo: number }).peak_elo)
      : SCRIMMAGE_DEFAULT_ELO;
    const newPeak = Math.max(peakBefore, newElo);
    const prevStreak = rating
      ? Number((rating as { current_streak: number }).current_streak)
      : 0;
    const newStreak =
      outcome === "win"
        ? prevStreak >= 0
          ? prevStreak + 1
          : 1
        : outcome === "loss"
          ? prevStreak <= 0
            ? prevStreak - 1
            : -1
          : 0;
    const wins =
      (rating ? Number((rating as { wins: number }).wins) : 0) +
      (outcome === "win" ? 1 : 0);
    const losses =
      (rating ? Number((rating as { losses: number }).losses) : 0) +
      (outcome === "loss" ? 1 : 0);
    const draws =
      (rating ? Number((rating as { draws: number }).draws) : 0) +
      (outcome === "draw" ? 1 : 0);
    const games =
      (rating ? Number((rating as { games_played: number }).games_played) : 0) +
      1;

    if (rating) {
      const { error: upErr } = await supabase
        .from("scrimmage_ratings")
        .update({
          elo: newElo,
          peak_elo: newPeak,
          wins,
          losses,
          draws,
          games_played: games,
          current_streak: newStreak,
          updated_at: new Date().toISOString(),
        })
        .eq("player_id", p.player_id);
      if (upErr) throw upErr;
    } else {
      const { error: insErr } = await supabase
        .from("scrimmage_ratings")
        .insert({
          player_id: p.player_id,
          elo: newElo,
          peak_elo: newPeak,
          wins,
          losses,
          draws,
          games_played: games,
          current_streak: newStreak,
        });
      if (insErr) throw insErr;
    }

    perPlayer.push({
      player_id: p.player_id,
      team: p.team,
      elo_before: p.elo_before,
      elo_after: eloAfter,
      delta,
    });
  }

  // Update the match row
  {
    const { error } = await supabase
      .from("scrimmage_matches")
      .update({
        status: "completed",
        team1_score: args.team1Score,
        team2_score: args.team2Score,
        team1_avg_elo: team1Avg,
        team2_avg_elo: team2Avg,
        reported_by: args.reportedBy,
        confirmed_by: args.confirmedBy,
        result_confirmed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", args.matchId);
    if (error) throw error;
  }

  return { team1Avg, team2Avg, team1Delta, team2Delta, perPlayer };
}

/** Look up a player's roblox_username for embed rendering. */
export async function fetchPlayerNamesByIds(
  supabase: SupabaseClient,
  playerIds: string[],
): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (playerIds.length === 0) return out;
  const { data, error } = await supabase
    .from("players")
    .select("id, roblox_username")
    .in("id", playerIds);
  if (error) throw error;
  for (const row of (data ?? []) as { id: string; roblox_username: string | null }[]) {
    if (row.roblox_username) out.set(row.id, row.roblox_username);
  }
  return out;
}
