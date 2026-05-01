import "server-only";

import { cache } from "react";

import { readAllMatchEventRecords } from "@/lib/match-event-records";
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

const LEADER_LIMIT = 10;

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
  const db = await loadFromSupabase();
  if (db && (db.goals.length > 0 || db.assists.length > 0)) return db;
  return loadFromEventFiles();
}

export const getLeaderboards = cache(resolveLeaderboards);
