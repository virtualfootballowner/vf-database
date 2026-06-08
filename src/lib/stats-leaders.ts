import "server-only";

import { unstable_noStore as noStore } from "next/cache";
import { cache } from "react";

import type { MatchRecord } from "@/app/stats/matches-data";
import { readAllMatchEventRecords } from "@/lib/match-event-records";
import { getSiteStatsBundle } from "@/lib/site-db";
import { competitionKeysWithResults } from "@/lib/stats-tournaments";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export type LeaderEntry = {
  rank: number;
  roblox_username: string;
  roblox_user_id: string | null;
  total: number;
};

export type Leaderboards = {
  source: "supabase" | "files";
  goals: LeaderEntry[];
  assists: LeaderEntry[];
};

export type TournamentLeaderboards = {
  season: number;
  competition: string;
  goals: LeaderEntry[];
  assists: LeaderEntry[];
};

export type TournamentLeaderboardsBundle = {
  source: "supabase" | "files";
  tournaments: TournamentLeaderboards[];
};

const LEADER_LIMIT = 10;

type AggRow = {
  username: string;
  roblox_user_id: string | null;
  total: number;
};

function tournamentKey(season: number, competition: string): string {
  return `${season}|${competition.trim()}`;
}

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

function bumpAgg(
  map: Map<string, AggRow>,
  username: string,
  robloxId: string | null,
  delta: number,
): void {
  const name = username.trim();
  if (!name || name === "—" || delta <= 0) return;
  const key = aggKey(name, robloxId);
  const row = map.get(key) ?? {
    username: name,
    roblox_user_id: robloxId?.trim() || null,
    total: 0,
  };
  row.total += delta;
  if (robloxId?.trim()) row.roblox_user_id = robloxId.trim();
  map.set(key, row);
}

function emptyTournamentAggs(
  keys: { season: number; competition: string }[],
): Map<string, { goals: Map<string, AggRow>; assists: Map<string, AggRow> }> {
  const out = new Map<
    string,
    { goals: Map<string, AggRow>; assists: Map<string, AggRow> }
  >();
  for (const { season, competition } of keys) {
    out.set(tournamentKey(season, competition), {
      goals: new Map(),
      assists: new Map(),
    });
  }
  return out;
}

function aggsToTournamentBoards(
  keys: { season: number; competition: string }[],
  aggs: Map<string, { goals: Map<string, AggRow>; assists: Map<string, AggRow> }>,
): TournamentLeaderboards[] {
  return keys.map(({ season, competition }) => {
    const bucket = aggs.get(tournamentKey(season, competition)) ?? {
      goals: new Map(),
      assists: new Map(),
    };
    return {
      season,
      competition,
      goals: rankList([...bucket.goals.values()]),
      assists: rankList([...bucket.assists.values()]),
    };
  });
}

function matchCountsForLeaderboards(
  match: MatchRecord | undefined,
): boolean {
  if (!match) return false;
  if (match.status === "scheduled" || match.status === "cancelled") return false;
  return true;
}

function rankList(
  rows: { username: string; roblox_user_id: string | null; total: number }[],
): LeaderEntry[] {
  const sorted = [...rows].sort((a, b) =>
    b.total !== a.total ? b.total - a.total : a.username.localeCompare(b.username),
  );
  return sorted.slice(0, LEADER_LIMIT).map((r, i) => ({
    rank: i + 1,
    roblox_username: r.username,
    roblox_user_id: r.roblox_user_id,
    total: r.total,
  }));
}

async function loadFromSupabase(): Promise<Leaderboards | null> {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return null;
  }
  try {
    const supabase = createSupabaseServerClient();
    const { data: goalRows, error: gErr } = await supabase
      .from("players")
      .select("roblox_username, roblox_user_id, goals_total, assists_total")
      .gt("goals_total", 0)
      .order("goals_total", { ascending: false })
      .order("roblox_username", { ascending: true })
      .limit(200);

    const { data: astRows, error: aErr } = await supabase
      .from("players")
      .select("roblox_username, roblox_user_id, assists_total")
      .gt("assists_total", 0)
      .order("assists_total", { ascending: false })
      .order("roblox_username", { ascending: true })
      .limit(200);

    if (gErr || aErr) return null;

    const goals = rankList(
      (goalRows ?? []).map((r) => ({
        username: r.roblox_username,
        roblox_user_id: r.roblox_user_id,
        total: r.goals_total ?? 0,
      })),
    );

    const assists = rankList(
      (astRows ?? []).map((r) => ({
        username: r.roblox_username,
        roblox_user_id: r.roblox_user_id,
        total: r.assists_total ?? 0,
      })),
    );

    return { source: "supabase", goals, assists };
  } catch {
    return null;
  }
}

/** Merge key: Roblox ID when present, else stable name key. */
function aggKey(username: string, robloxId: string | null): string {
  const rid = robloxId?.trim();
  if (rid) return `id:${rid}`;
  return `name:${username.trim().toLowerCase()}`;
}

function loadFromEventFiles(): Leaderboards {
  const goalsM = new Map<
    string,
    { username: string; roblox_user_id: string | null; total: number }
  >();
  const astM = new Map<
    string,
    { username: string; roblox_user_id: string | null; total: number }
  >();

  for (const e of readAllMatchEventRecords()) {
    const name = e.player?.trim();
    if (!name || name === "—") continue;
    const key = aggKey(name, e.robloxId);

    if (e.type === "Goal") {
      const g = goalsM.get(key) ?? {
        username: name,
        roblox_user_id: e.robloxId?.trim() || null,
        total: 0,
      };
      g.total += e.count > 0 ? e.count : 1;
      if (e.robloxId?.trim()) g.roblox_user_id = e.robloxId.trim();
      goalsM.set(key, g);
    }
    if (e.type === "Assist") {
      const g = astM.get(key) ?? {
        username: name,
        roblox_user_id: e.robloxId?.trim() || null,
        total: 0,
      };
      g.total += e.count > 0 ? e.count : 1;
      if (e.robloxId?.trim()) g.roblox_user_id = e.robloxId.trim();
      astM.set(key, g);
    }
  }

  return {
    source: "files",
    goals: rankList([...goalsM.values()]),
    assists: rankList([...astM.values()]),
  };
}

async function resolveLeaderboards(): Promise<Leaderboards> {
  noStore();
  const db = await loadFromSupabase();
  if (db && (db.goals.length > 0 || db.assists.length > 0)) return db;
  return loadFromEventFiles();
}

export const getLeaderboards = cache(resolveLeaderboards);

async function loadTournamentFromSupabase(
  keys: { season: number; competition: string }[],
  matchesByRobloxId: Map<string, MatchRecord>,
): Promise<TournamentLeaderboardsBundle | null> {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return null;
  }

  try {
    const supabase = createSupabaseServerClient();
    const { data: evRows, error: evErr } = await supabase
      .from("match_events")
      .select(
        "event_type, player_id, details, matches!inner(season, competition, status, roblox_match_id)",
      )
      .in("event_type", ["goal", "assist"])
      .eq("matches.status", "completed");

    if (evErr) return null;

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
      if (pErr) return null;
      for (const row of playerRows ?? []) {
        const id = normStr(row.id);
        const username = normStr(row.roblox_username);
        const robloxUserId = normStr(row.roblox_user_id);
        if (id && username) usernameByPlayerId.set(id, username);
        if (id && robloxUserId) robloxIdByPlayerId.set(id, robloxUserId);
      }
    }

    const aggs = emptyTournamentAggs(keys);

    for (const ev of evRows ?? []) {
      const matchJoined = ev.matches as
        | {
            season: number;
            competition: string;
            status: string | null;
            roblox_match_id: string | null;
          }
        | {
            season: number;
            competition: string;
            status: string | null;
            roblox_match_id: string | null;
          }[]
        | null
        | undefined;
      const matchRaw = Array.isArray(matchJoined) ? matchJoined[0] : matchJoined;
      if (!matchRaw?.competition?.trim()) continue;

      const robloxId = matchRaw.roblox_match_id?.trim() || "";
      const fileMatch = robloxId ? matchesByRobloxId.get(robloxId) : undefined;
      if (
        fileMatch &&
        (fileMatch.status === "scheduled" || fileMatch.status === "cancelled")
      ) {
        continue;
      }

      const tk = tournamentKey(matchRaw.season, matchRaw.competition);
      const bucket = aggs.get(tk);
      if (!bucket) continue;

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

      if (type === "goal") {
        bumpAgg(bucket.goals, username, robloxUserId, count);
      } else if (type === "assist") {
        bumpAgg(bucket.assists, username, robloxUserId, count);
      }
    }

    return {
      source: "supabase",
      tournaments: aggsToTournamentBoards(keys, aggs),
    };
  } catch {
    return null;
  }
}

function loadTournamentFromEventFiles(
  keys: { season: number; competition: string }[],
  matchesByRobloxId: Map<string, MatchRecord>,
): TournamentLeaderboardsBundle {
  const aggs = emptyTournamentAggs(keys);

  for (const e of readAllMatchEventRecords()) {
    const match = matchesByRobloxId.get(e.matchId);
    if (!match || !matchCountsForLeaderboards(match)) continue;

    const tk = tournamentKey(match.season, match.competition);
    const bucket = aggs.get(tk);
    if (!bucket) continue;

    const name = e.player?.trim();
    if (!name || name === "—") continue;
    const count = e.count > 0 ? e.count : 1;

    if (e.type === "Goal") {
      bumpAgg(bucket.goals, name, e.robloxId?.trim() || null, count);
    } else if (e.type === "Assist") {
      bumpAgg(bucket.assists, name, e.robloxId?.trim() || null, count);
    }
  }

  return {
    source: "files",
    tournaments: aggsToTournamentBoards(keys, aggs),
  };
}

async function resolveTournamentLeaderboards(): Promise<TournamentLeaderboardsBundle> {
  noStore();
  const bundle = await getSiteStatsBundle();
  const keys = competitionKeysWithResults(bundle.allMatches);
  const db = await loadTournamentFromSupabase(keys, bundle.matchesByRobloxId);
  if (db) return db;
  return loadTournamentFromEventFiles(keys, bundle.matchesByRobloxId);
}

export const getTournamentLeaderboards = cache(resolveTournamentLeaderboards);
