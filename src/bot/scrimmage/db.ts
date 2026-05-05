import type { SupabaseClient } from "@supabase/supabase-js";

import { SCRIMMAGE_DEFAULT_ELO } from "@/bot/scrimmage/elo";

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
 * Top N by ELO, joined to `players.roblox_username` for display. Players who
 * have never queued won't appear (they only show up after their first match
 * via `ensureScrimmageRating`).
 */
export async function fetchScrimmageLeaderboard(
  supabase: SupabaseClient,
  topN = 10,
): Promise<LeaderboardEntry[]> {
  const { data, error } = await supabase
    .from("scrimmage_ratings")
    .select(
      "player_id, elo, wins, losses, draws, games_played, peak_elo, players:player_id(roblox_username)",
    )
    .order("elo", { ascending: false })
    .order("games_played", { ascending: false })
    .limit(topN);
  if (error) throw error;

  /** Supabase typegen returns embedded FK joins as an array even for many-to-one. */
  type Row = Omit<LeaderboardEntry, "roblox_username"> & {
    players: { roblox_username: string | null }[] | null;
  };
  return ((data ?? []) as unknown as Row[]).map((row) => ({
    player_id: row.player_id,
    roblox_username:
      row.players?.[0]?.roblox_username ?? "Unknown",
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
