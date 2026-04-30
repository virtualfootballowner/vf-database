/**
 * Loads every match + event from the website sources into Supabase `tournaments`,
 * `teams`, `matches`, and `match_events` (your existing UUID schema).
 *
 * Prereq: `.env.local` with SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
 * Run: npm run db:import:website
 */
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import path from "node:path";

import {
  matches,
  resolveTeamForWebsiteName,
  type MatchRecord,
} from "../src/app/stats/matches-data";
import {
  readAllMatchEventRecords,
  type MatchEventRecord,
} from "../src/lib/match-event-records";

config({ path: path.resolve(process.cwd(), ".env.local"), override: true });

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
});

type DbEventType =
  | "goal"
  | "assist"
  | "yellow_card"
  | "red_card"
  | "own_goal"
  | "penalty_scored"
  | "penalty_missed"
  | "substitution"
  | "motm"
  | "forfeit"
  | "no_stats";

function mapCsvEventType(csv: string): DbEventType | null {
  switch (csv) {
    case "Goal":
      return "goal";
    case "Assist":
      return "assist";
    case "OG":
      return "own_goal";
    case "Yellow Card":
      return "yellow_card";
    case "Red Card":
      return "red_card";
    case "MOTM":
      return "motm";
    case "FFT":
      return "forfeit";
    case "No Stats":
      return "no_stats";
    default:
      return null;
  }
}

function parseMatchWeek(gw: string): number | null {
  const m = /^GW(\d+)$/i.exec(gw.trim());
  return m ? Number.parseInt(m[1], 10) : null;
}

function tournamentKey(m: MatchRecord): string {
  return `${m.season}|${m.competition || "—"}`;
}

function tournamentTypeAndFormat(
  competition: string,
): { type: "league" | "friendly" | "world_cup"; format: "round_robin" | "knockout_only" | "groups_knockout" } {
  const c = competition || "";
  if (c.includes("Playoff")) {
    return { type: "league", format: "knockout_only" };
  }
  if (c === "—" || !c.trim()) {
    return { type: "friendly", format: "round_robin" };
  }
  return { type: "league", format: "round_robin" };
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

/**
 * One row per person: prefer Roblox ID key; drop name-only keys when that name
 * later has an ID (same as CSV seed script).
 */
function mergePlayerProfilesFromEvents(events: MatchEventRecord[]) {
  const merged = new Map<string, { username: string; robloxUserId: string | null }>();

  for (const e of events) {
    const name = e.player?.trim();
    if (!name || name === "—") continue;

    const rid = e.robloxId?.trim() || null;
    const key = rid ? `id:${rid}` : `name:${name.toLowerCase()}`;
    const cur = merged.get(key);
    if (!cur) {
      merged.set(key, { username: name, robloxUserId: rid });
    } else if (rid && !cur.robloxUserId) {
      merged.set(key, { username: name, robloxUserId: rid });
    }
  }

  const lowerToRobloxId = new Map<string, string>();
  for (const v of merged.values()) {
    if (v.robloxUserId) {
      lowerToRobloxId.set(v.username.toLowerCase(), v.robloxUserId);
    }
  }

  for (const key of merged.keys()) {
    if (!key.startsWith("name:")) continue;
    const lower = key.slice("name:".length);
    if (lowerToRobloxId.has(lower)) {
      merged.delete(key);
    }
  }

  return merged;
}

type PlayerMaps = {
  byRobloxId: Map<string, string>;
  byUsernameLower: Map<string, string>;
};

async function ensurePlayersFromEvents(
  supabase: ReturnType<typeof createClient>,
  events: MatchEventRecord[],
): Promise<PlayerMaps> {
  const merged = mergePlayerProfilesFromEvents(events);
  const byRobloxId = new Map<string, string>();
  const byUsernameLower = new Map<string, string>();

  for (const { username, robloxUserId } of merged.values()) {
    if (robloxUserId) {
      const ex = await supabase
        .from("players")
        .select("id")
        .eq("roblox_user_id", robloxUserId)
        .maybeSingle();
      if (ex.error) throw ex.error;
      if (ex.data?.id) {
        byRobloxId.set(robloxUserId, ex.data.id);
        byUsernameLower.set(username.toLowerCase(), ex.data.id);
        continue;
      }

      const ins = await supabase
        .from("players")
        .insert({
          roblox_username: username,
          roblox_user_id: robloxUserId,
          discord_id: null,
          discord_username: null,
          status: "inactive" as const,
        })
        .select("id")
        .single();
      if (ins.error) throw ins.error;
      const id = ins.data!.id;
      byRobloxId.set(robloxUserId, id);
      byUsernameLower.set(username.toLowerCase(), id);
    } else {
      const ex = await supabase
        .from("players")
        .select("id, roblox_user_id")
        .ilike("roblox_username", username)
        .is("roblox_user_id", null)
        .maybeSingle();
      if (ex.error) throw ex.error;
      if (ex.data?.id) {
        byUsernameLower.set(username.toLowerCase(), ex.data.id);
        continue;
      }

      const ex2 = await supabase
        .from("players")
        .select("id")
        .ilike("roblox_username", username)
        .not("roblox_user_id", "is", null)
        .maybeSingle();
      if (ex2.error) throw ex2.error;
      if (ex2.data?.id) {
        byUsernameLower.set(username.toLowerCase(), ex2.data.id);
        continue;
      }

      const ins = await supabase
        .from("players")
        .insert({
          roblox_username: username,
          roblox_user_id: null,
          discord_id: null,
          discord_username: null,
          status: "inactive" as const,
        })
        .select("id")
        .single();
      if (ins.error) throw ins.error;
      byUsernameLower.set(username.toLowerCase(), ins.data!.id);
    }
  }

  return { byRobloxId, byUsernameLower };
}

function resolvePlayerIdForEvent(
  e: MatchEventRecord,
  maps: PlayerMaps,
): string | null {
  const name = e.player?.trim();
  if (!name || name === "—") return null;
  const rid = e.robloxId?.trim();
  if (rid && maps.byRobloxId.has(rid)) return maps.byRobloxId.get(rid)!;
  return maps.byUsernameLower.get(name.toLowerCase()) ?? null;
}

const ZERO = "00000000-0000-0000-0000-000000000000";

async function main() {
  // PostgREST requires a filter on delete; UUIDs never equal all-zero placeholder.
  const { error: delEv } = await supabase.from("match_events").delete().neq("id", ZERO);
  if (delEv) throw delEv;
  const { error: delM } = await supabase.from("matches").delete().neq("id", ZERO);
  if (delM) throw delM;
  const { error: delT } = await supabase.from("tournaments").delete().neq("id", ZERO);
  if (delT) throw delT;
  const { error: delTeams } = await supabase.from("teams").delete().neq("id", ZERO);
  if (delTeams) throw delTeams;

  const teamNames = new Set<string>();
  for (const m of matches) {
    teamNames.add(m.homeTeam);
    teamNames.add(m.awayTeam);
  }
  for (const e of readAllMatchEventRecords()) {
    if (e.team && e.team !== "—") teamNames.add(e.team);
  }

  const teamRows: { name: string; abbreviation: string }[] = [];
  const seenDbName = new Set<string>();
  for (const name of teamNames) {
    const t = resolveTeamForWebsiteName(name);
    if (seenDbName.has(t.name)) continue;
    seenDbName.add(t.name);
    const abbrev = (t.short || t.name.slice(0, 6)).slice(0, 8).toUpperCase();
    teamRows.push({ name: t.name, abbreviation: abbrev || "TM" });
  }

  const { data: insertedTeams, error: teamErr } = await supabase
    .from("teams")
    .insert(teamRows)
    .select("id, name");
  if (teamErr) throw teamErr;

  const teamIdByName = new Map<string, string>();
  for (const row of insertedTeams ?? []) {
    teamIdByName.set(row.name, row.id);
  }

  const byKey = new Map<string, MatchRecord[]>();
  for (const m of matches) {
    const k = tournamentKey(m);
    if (!byKey.has(k)) byKey.set(k, []);
    byKey.get(k)!.push(m);
  }

  const tournamentIdByKey = new Map<string, string>();
  for (const [key, group] of byKey) {
    const [seasonStr, competition] = key.split("|");
    const season = Number.parseInt(seasonStr, 10);
    const dates = group.map((g) => g.date).sort();
    const start = dates[0]!;
    const end = dates[dates.length - 1]!;
    const labelComp = competition === "—" ? "Unassigned competition" : competition;
    const { type, format } = tournamentTypeAndFormat(competition);

    const { data: tRow, error: tErr } = await supabase
      .from("tournaments")
      .insert({
        name: `Season ${season} · ${labelComp}`,
        type,
        format,
        status: "completed" as const,
        start_date: start,
        end_date: end,
      })
      .select("id")
      .single();
    if (tErr) throw tErr;
    tournamentIdByKey.set(key, tRow!.id);
  }

  const externalIdToMatchUuid = new Map<string, string>();

  for (const batch of chunk(matches, 30)) {
    const rows = batch.map((m) => {
      const home = resolveTeamForWebsiteName(m.homeTeam);
      const away = resolveTeamForWebsiteName(m.awayTeam);
      const hid = teamIdByName.get(home.name);
      const aid = teamIdByName.get(away.name);
      if (!hid || !aid) {
        throw new Error(`Missing team id for ${m.id}: ${home.name}, ${away.name}`);
      }
      const tKey = tournamentKey(m);
      const tid = tournamentIdByKey.get(tKey);
      if (!tid) throw new Error(`No tournament for ${tKey}`);

      const day = new Date(`${m.date}T12:00:00.000Z`);
      return {
        tournament_id: tid,
        home_team_id: hid,
        away_team_id: aid,
        home_score: m.homeScore,
        away_score: m.awayScore,
        stage: m.stage,
        match_week: parseMatchWeek(m.gameWeek),
        status: "completed" as const,
        scheduled_at: day.toISOString(),
        ended_at: day.toISOString(),
        roblox_match_id: m.id,
        referee: m.referee.trim() || null,
      };
    });

    const { data: mIns, error: mErr } = await supabase.from("matches").insert(rows).select("id, roblox_match_id");
    if (mErr) throw mErr;
    for (const r of mIns ?? []) {
      if (r.roblox_match_id) externalIdToMatchUuid.set(r.roblox_match_id, r.id);
    }
  }

  console.log(`Inserted ${externalIdToMatchUuid.size} matches.`);

  const events = readAllMatchEventRecords();
  console.log("Ensuring players from all events (Discord left empty when new)...");
  const playerMaps = await ensurePlayersFromEvents(supabase, events);
  console.log(`Player registry: ${playerMaps.byUsernameLower.size} usernames mapped to ids.`);

  const eventRows: {
    match_id: string;
    player_id: string | null;
    team_id: string | null;
    event_type: DbEventType;
    minute: null;
    details: Record<string, unknown>;
  }[] = [];

  for (const e of events) {
    const dbType = mapCsvEventType(e.type);
    if (!dbType) continue;
    const mid = externalIdToMatchUuid.get(e.matchId);
    if (!mid) continue;

    let teamId: string | null = null;
    if (e.team && e.team !== "—") {
      const meta = resolveTeamForWebsiteName(e.team);
      teamId = teamIdByName.get(meta.name) ?? null;
    }

    const details: Record<string, unknown> = {
      source: "vfl_website_csv",
      player: e.player,
      roblox_user_id: e.robloxId,
      count: e.count,
      notes: e.notes || null,
    };
    if (e.reason) details.reason = e.reason;

    eventRows.push({
      match_id: mid,
      player_id: resolvePlayerIdForEvent(e, playerMaps),
      team_id: teamId,
      event_type: dbType,
      minute: null,
      details,
    });
  }

  for (const batch of chunk(eventRows, 150)) {
    const { error: evErr } = await supabase.from("match_events").insert(batch);
    if (evErr) throw evErr;
  }

  console.log(`Inserted ${eventRows.length} match events.`);

  const { error: rpcErr } = await supabase.rpc("refresh_player_goal_assist_totals");
  if (rpcErr) throw rpcErr;
  console.log("Refreshed players.goals_total / assists_total from match_events.");

  console.log(`Teams: ${teamIdByName.size}, tournaments: ${tournamentIdByKey.size}. Done.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
