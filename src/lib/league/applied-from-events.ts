import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  ApplyMatchResultOutput,
  MatchForResults,
  ResolvedPlayer,
} from "@/bot/results/queries";

function normCount(details: unknown): number {
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

function normStr(v: unknown): string {
  return v == null ? "" : String(v).trim();
}

function bump(
  map: Map<string, ResolvedPlayer>,
  username: string,
  count: number,
  playerId: string | null,
  robloxUserId: string | null,
  teamId: string | null,
  teamName: string | null,
): void {
  const key = username.toLowerCase();
  const existing = map.get(key);
  if (existing) {
    existing.count += count;
    return;
  }
  map.set(key, {
    username,
    count,
    playerId,
    robloxUserId,
    teamId,
    teamName,
    warnings: [],
  });
}

/** Build `/results`-style output from rows already stored in `match_events`. */
export async function loadAppliedFromMatchEvents(
  supabase: SupabaseClient,
  match: MatchForResults,
): Promise<ApplyMatchResultOutput> {
  const { data: evRows, error: evErr } = await supabase
    .from("match_events")
    .select("event_type, player_id, team_id, details")
    .eq("match_id", match.id);
  if (evErr) throw evErr;

  const playerIds = [
    ...new Set(
      (evRows ?? [])
        .map((ev) => ev.player_id)
        .filter((id): id is string => Boolean(id)),
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

  const teamNameById = new Map<string, string>([
    [match.home_team_id, match.home_name],
    [match.away_team_id, match.away_name],
  ]);

  const scorers = new Map<string, ResolvedPlayer>();
  const assists = new Map<string, ResolvedPlayer>();
  const yellows = new Map<string, ResolvedPlayer>();
  const reds = new Map<string, ResolvedPlayer>();
  let motm: ResolvedPlayer | null = null;

  for (const ev of evRows ?? []) {
    const type = normStr(ev.event_type).toLowerCase();
    const details =
      ev.details &&
      typeof ev.details === "object" &&
      !Array.isArray(ev.details)
        ? (ev.details as Record<string, unknown>)
        : {};

    const playerId = normStr(ev.player_id) || null;
    let username = normStr(details.player);
    if (!username && playerId) {
      username = usernameByPlayerId.get(playerId) ?? "";
    }
    if (!username) continue;

    const robloxUserId =
      normStr(details.roblox_user_id) ||
      (playerId ? robloxIdByPlayerId.get(playerId) ?? null : null);
    const teamId = normStr(ev.team_id) || null;
    const teamName = teamId ? teamNameById.get(teamId) ?? null : null;
    const count = normCount(details);

    if (type === "goal") {
      bump(scorers, username, count, playerId, robloxUserId, teamId, teamName);
    } else if (type === "assist") {
      bump(assists, username, count, playerId, robloxUserId, teamId, teamName);
    } else if (type === "yellow_card") {
      bump(yellows, username, count, playerId, robloxUserId, teamId, teamName);
    } else if (type === "red_card") {
      bump(reds, username, count, playerId, robloxUserId, teamId, teamName);
    } else if (type === "motm") {
      motm = {
        username,
        count: 1,
        playerId,
        robloxUserId,
        teamId,
        teamName,
        warnings: [],
      };
    }
  }

  return {
    resolvedScorers: [...scorers.values()],
    resolvedAssists: [...assists.values()],
    resolvedMotm: motm,
    resolvedYellows: [...yellows.values()],
    resolvedReds: [...reds.values()],
    warnings: [],
  };
}
