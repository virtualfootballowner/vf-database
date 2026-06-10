import type { SupabaseClient } from "@supabase/supabase-js";

export type TournamentLeaderRow = {
  roblox_username: string;
  count: number;
};

function normStr(v: unknown): string {
  return v == null ? "" : String(v).trim();
}

function eventCount(details: unknown): number {
  if (
    details &&
    typeof details === "object" &&
    !Array.isArray(details) &&
    "count" in details
  ) {
    const raw = (details as Record<string, unknown>).count;
    const n =
      typeof raw === "number"
        ? raw
        : Number.parseInt(String(raw ?? "").trim(), 10);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return 1;
}

function aggKey(username: string, robloxId: string | null): string {
  const rid = robloxId?.trim();
  if (rid) return `id:${rid}`;
  return `name:${username.trim().toLowerCase()}`;
}

function rankRows(
  map: Map<string, { username: string; total: number }>,
  topN: number,
): TournamentLeaderRow[] {
  return [...map.values()]
    .sort((a, b) =>
      b.total !== a.total
        ? b.total - a.total
        : a.username.localeCompare(b.username),
    )
    .slice(0, topN)
    .map((r) => ({ roblox_username: r.username, count: r.total }));
}

/** Top scorers + assisters for one (season, competition) from completed match events. */
export async function fetchTournamentLeaders(
  supabase: SupabaseClient,
  season: number,
  competition: string,
  topN = 10,
): Promise<{
  goals: TournamentLeaderRow[];
  assists: TournamentLeaderRow[];
  totalGoals: number;
  totalAssists: number;
}> {
  const { data: evRows, error: evErr } = await supabase
    .from("match_events")
    .select(
      "event_type, player_id, details, matches!inner(season, competition, status)",
    )
    .in("event_type", ["goal", "assist"])
    .eq("matches.status", "completed")
    .eq("matches.season", season)
    .eq("matches.competition", competition.trim());

  if (evErr) throw evErr;

  const playerIds = [
    ...new Set(
      (evRows ?? [])
        .map((ev) => normStr(ev.player_id))
        .filter(Boolean),
    ),
  ];

  const usernameByPlayerId = new Map<string, string>();
  const robloxIdByPlayerId = new Map<string, string>();
  if (playerIds.length > 0) {
    const { data: playerRows, error: pErr } = await supabase
      .from("players")
      .select("id, roblox_username, roblox_user_id")
      .in("id", playerIds);
    if (pErr) throw pErr;
    for (const row of playerRows ?? []) {
      const id = normStr(row.id);
      const username = normStr(row.roblox_username);
      const robloxUserId = normStr(row.roblox_user_id);
      if (id && username) usernameByPlayerId.set(id, username);
      if (id && robloxUserId) robloxIdByPlayerId.set(id, robloxUserId);
    }
  }

  const goalsM = new Map<string, { username: string; total: number }>();
  const assistsM = new Map<string, { username: string; total: number }>();
  let totalGoals = 0;
  let totalAssists = 0;

  for (const ev of evRows ?? []) {
    const details =
      ev.details &&
      typeof ev.details === "object" &&
      !Array.isArray(ev.details)
        ? (ev.details as Record<string, unknown>)
        : {};

    const playerId = normStr(ev.player_id);
    let username = normStr(details.player);
    if (!username && playerId) {
      username = usernameByPlayerId.get(playerId) ?? "";
    }
    if (!username) continue;

    const robloxUserId =
      normStr(details.roblox_user_id) ||
      (playerId ? robloxIdByPlayerId.get(playerId) ?? null : null);
    const count = eventCount(details);
    const type = normStr(ev.event_type).toLowerCase();
    const key = aggKey(username, robloxUserId);

    if (type === "goal") {
      const row = goalsM.get(key) ?? { username, total: 0 };
      row.total += count;
      goalsM.set(key, row);
      totalGoals += count;
    } else if (type === "assist") {
      const row = assistsM.get(key) ?? { username, total: 0 };
      row.total += count;
      assistsM.set(key, row);
      totalAssists += count;
    }
  }

  return {
    goals: rankRows(goalsM, topN),
    assists: rankRows(assistsM, topN),
    totalGoals,
    totalAssists,
  };
}
