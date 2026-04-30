/**
 * Compare `matches-data` + `readAllMatchEventRecords()` to live Supabase `matches` / `match_events`.
 * Exit 1 on any mismatch. Prereq: `.env.local` with SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY.
 */
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import path from "node:path";

import { matches, resolveTeamForWebsiteName } from "../src/app/stats/matches-data";
import { readAllMatchEventRecords, type MatchEventRecord } from "../src/lib/match-event-records";
import { teams as catalogTeams, type Team } from "../src/app/teams/teams-data";

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

function normDetail(v: unknown): string {
  if (v == null || v === "") return "";
  if (typeof v === "number") return String(v);
  return String(v).trim();
}

function teamCanonicalFromEvent(e: MatchEventRecord): string {
  if (!e.team || e.team === "—") return "";
  return resolveTeamForWebsiteName(e.team).name;
}

/** Stable multiset key aligned with import script fields in `details` + event_type + team name */
function expectedEventKey(matchId: string, e: MatchEventRecord): string | null {
  const dbType = mapCsvEventType(e.type);
  if (!dbType) return null;
  const teamName = teamCanonicalFromEvent(e);
  const player = normDetail(e.player);
  const roblox = normDetail(e.robloxId);
  const count = normDetail(e.count);
  const notes = normDetail(e.notes);
  const reason = normDetail(e.reason);
  return `${matchId}|${dbType}|${teamName}|${player}|${roblox}|${count}|${notes}|${reason}`;
}

function dbEventKey(
  robloxMatchId: string,
  eventType: string,
  teamName: string,
  details: Record<string, unknown> | null,
): string {
  const d = details ?? {};
  return `${robloxMatchId}|${eventType}|${normDetail(teamName)}|${normDetail(d.player)}|${normDetail(d.roblox_user_id)}|${normDetail(d.count)}|${normDetail(d.notes)}|${normDetail(d.reason)}`;
}

function sortKeys(keys: string[]): string[] {
  return [...keys].sort((a, b) => a.localeCompare(b));
}

function sameSeasons(
  db: number[] | null | undefined,
  expected: number[],
): boolean {
  const a = [...(db ?? [])].sort((x, y) => x - y).join(",");
  const b = [...expected].sort((x, y) => x - y).join(",");
  return a === b;
}

async function main() {
  let failed = false;
  const matchIds = new Set(matches.map((m) => m.id));

  const { data: teamRows, error: teamErr } = await supabase
    .from("teams")
    .select("id, name, slug, logo_url, form_label, seasons, abbreviation");
  if (teamErr) throw teamErr;
  const teamNameById = new Map<string, string>();
  const dbTeamByName = new Map<
    string,
    {
      id: string;
      name: string;
      slug: string | null;
      logo_url: string | null;
      form_label: string | null;
      seasons: number[] | null;
      abbreviation: string | null;
    }
  >();
  for (const t of teamRows ?? []) {
    teamNameById.set(t.id, t.name);
    dbTeamByName.set(t.name, t);
  }

  const { data: tournamentRows, error: tourErr } = await supabase
    .from("tournaments")
    .select("id, season, competition");
  if (tourErr) throw tourErr;
  const tourneyById = new Map(
    (tournamentRows ?? []).map((r) => [r.id, r] as const),
  );

  const { data: dbMatchRows, error: mErr } = await supabase
    .from("matches")
    .select(
      "id, tournament_id, roblox_match_id, home_team_id, away_team_id, home_score, away_score, stage, match_week, scheduled_at, referee, season, competition, game_week_label, fft, match_notes",
    );
  if (mErr) throw mErr;

  const dbByRoblox = new Map<string, (typeof dbMatchRows)[number]>();
  for (const r of dbMatchRows ?? []) {
    if (r.roblox_match_id) dbByRoblox.set(r.roblox_match_id, r);
  }

  console.log(`Repo matches: ${matches.length}; DB matches (with roblox_match_id): ${dbByRoblox.size}`);

  if (matches.length !== dbByRoblox.size) {
    failed = true;
    console.error("FAIL: match count differs.");
    const repoIds = new Set(matches.map((m) => m.id));
    const dbIds = new Set(dbByRoblox.keys());
    for (const id of repoIds) {
      if (!dbIds.has(id)) console.error(`  missing in DB: ${id}`);
    }
    for (const id of dbIds) {
      if (!repoIds.has(id)) console.error(`  extra in DB (not in repo matches-data): ${id}`);
    }
  }

  for (const m of matches) {
    const row = dbByRoblox.get(m.id);
    if (!row) continue;
    const homeName = teamNameById.get(row.home_team_id) ?? "";
    const awayName = teamNameById.get(row.away_team_id) ?? "";
    const wantHome = resolveTeamForWebsiteName(m.homeTeam).name;
    const wantAway = resolveTeamForWebsiteName(m.awayTeam).name;
    const day = new Date(`${m.date}T12:00:00.000Z`).toISOString().slice(0, 10);
    const gotDay =
      row.scheduled_at == null ? "" : String(row.scheduled_at).slice(0, 10);
    const wantMw = parseMatchWeek(m.gameWeek);
    const problems: string[] = [];
    if (homeName !== wantHome) problems.push(`home team DB=${homeName} repo=${wantHome}`);
    if (awayName !== wantAway) problems.push(`away team DB=${awayName} repo=${wantAway}`);
    if (row.home_score !== m.homeScore) problems.push(`home_score DB=${row.home_score} repo=${m.homeScore}`);
    if (row.away_score !== m.awayScore) problems.push(`away_score DB=${row.away_score} repo=${m.awayScore}`);
    if ((row.stage ?? "") !== m.stage) problems.push(`stage DB=${row.stage} repo=${m.stage}`);
    if (row.match_week !== wantMw) problems.push(`match_week DB=${row.match_week} repo=${wantMw}`);
    if (gotDay !== m.date) problems.push(`date DB=${gotDay} repo=${m.date}`);
    const wantRef = m.referee.trim();
    const gotRef = normDetail(row.referee);
    if (gotRef !== wantRef) problems.push(`referee DB=${gotRef || "∅"} repo=${wantRef || "∅"}`);
    if (row.season !== m.season) problems.push(`season DB=${row.season} repo=${m.season}`);
    if ((row.competition ?? "") !== (m.competition ?? "")) {
      problems.push(`competition DB=${row.competition ?? "∅"} repo=${m.competition ?? "∅"}`);
    }
    if ((row.game_week_label ?? "") !== (m.gameWeek ?? "")) {
      problems.push(`game_week_label DB=${row.game_week_label ?? "∅"} repo=${m.gameWeek ?? "∅"}`);
    }
    if ((row.fft ?? "") !== m.fft) problems.push(`fft DB=${row.fft ?? "∅"} repo=${m.fft}`);
    if (normDetail(row.match_notes) !== normDetail(m.notes)) {
      problems.push(`match_notes mismatch`);
    }
    const tr = row.tournament_id ? tourneyById.get(row.tournament_id) : undefined;
    if (tr) {
      if (tr.season !== m.season) {
        problems.push(`tournament.season DB=${tr.season} repo=${m.season}`);
      }
      const wantTComp = m.competition === "—" ? null : m.competition;
      const gotTComp = tr.competition ?? null;
      if (wantTComp !== gotTComp) {
        problems.push(
          `tournament.competition DB=${gotTComp ?? "∅"} repo=${wantTComp ?? "∅"}`,
        );
      }
    }
    if (problems.length) {
      failed = true;
      console.error(`FAIL match ${m.id}: ${problems.join("; ")}`);
    }
  }

  const events = readAllMatchEventRecords();
  const orphanCsv = events.filter((e) => !matchIds.has(e.matchId));
  if (orphanCsv.length) {
    failed = true;
    console.error(`FAIL: ${orphanCsv.length} CSV event rows reference unknown match ids (sample):`);
    console.error(orphanCsv.slice(0, 15).map((e) => `${e.matchId} ${e.type}`).join("\n"));
  }

  const expectedKeys: string[] = [];
  for (const e of events) {
    if (!matchIds.has(e.matchId)) continue;
    const k = expectedEventKey(e.matchId, e);
    if (k) expectedKeys.push(k);
  }

  const matchUuidToRoblox = new Map<string, string>();
  for (const r of dbMatchRows ?? []) {
    if (r.roblox_match_id) matchUuidToRoblox.set(r.id, r.roblox_match_id);
  }

  const { data: evRows, error: evErr } = await supabase
    .from("match_events")
    .select("match_id, event_type, team_id, details");
  if (evErr) throw evErr;

  const dbKeys: string[] = [];
  for (const ev of evRows ?? []) {
    const robloxId = matchUuidToRoblox.get(ev.match_id);
    if (!robloxId) continue;
    const teamName = ev.team_id ? (teamNameById.get(ev.team_id) ?? "") : "";
    const details =
      ev.details && typeof ev.details === "object" && !Array.isArray(ev.details)
        ? (ev.details as Record<string, unknown>)
        : {};
    dbKeys.push(
      dbEventKey(robloxId, String(ev.event_type), teamName, details),
    );
  }

  const sortedExpected = sortKeys(expectedKeys);
  const sortedDb = sortKeys(dbKeys);

  console.log(`Repo events (importable, known match): ${sortedExpected.length}; DB match_events: ${sortedDb.length}`);

  if (sortedExpected.length !== sortedDb.length) {
    failed = true;
    console.error("FAIL: event count differs.");
    const ec = new Map<string, number>();
    const dc = new Map<string, number>();
    for (const k of sortedExpected) ec.set(k, (ec.get(k) ?? 0) + 1);
    for (const k of sortedDb) dc.set(k, (dc.get(k) ?? 0) + 1);
    const allKeys = new Set([...ec.keys(), ...dc.keys()]);
    let printed = 0;
    for (const k of sortKeys([...allKeys])) {
      const a = ec.get(k) ?? 0;
      const b = dc.get(k) ?? 0;
      if (a !== b) {
        console.error(`  ${a} repo vs ${b} db  ${k.slice(0, 160)}${k.length > 160 ? "…" : ""}`);
        if (++printed >= 40) {
          console.error("  … (truncated)");
          break;
        }
      }
    }
  } else {
    for (let i = 0; i < sortedExpected.length; i++) {
      if (sortedExpected[i] !== sortedDb[i]) {
        failed = true;
        console.error(`FAIL: event mismatch at sorted index ${i}`);
        console.error(`  repo: ${sortedExpected[i]?.slice(0, 200)}`);
        console.error(`  db:   ${sortedDb[i]?.slice(0, 200)}`);
        break;
      }
    }
  }

  if (!failed) {
    const teamNames = new Set<string>();
    for (const m of matches) {
      teamNames.add(m.homeTeam);
      teamNames.add(m.awayTeam);
    }
    for (const e of readAllMatchEventRecords()) {
      if (e.team && e.team !== "—") teamNames.add(e.team);
    }
    const expectedTeams = new Map<string, Team>();
    for (const t of catalogTeams) expectedTeams.set(t.name, t);
    for (const raw of teamNames) {
      const t = resolveTeamForWebsiteName(raw);
      expectedTeams.set(t.name, t);
    }
    for (const [name, exp] of expectedTeams) {
      const dbRow = dbTeamByName.get(name);
      if (!dbRow) {
        failed = true;
        console.error(`FAIL: team row missing in DB: ${name}`);
        continue;
      }
      const expSlug = exp.slug?.trim() ?? "";
      const gotSlug = (dbRow.slug ?? "").trim();
      if (gotSlug !== expSlug) {
        failed = true;
        console.error(`FAIL team ${name}: slug DB=${gotSlug || "∅"} repo=${expSlug || "∅"}`);
      }
      const expLogo = exp.logo?.trim() ?? "";
      const gotLogo = (dbRow.logo_url ?? "").trim();
      if (gotLogo !== expLogo) {
        failed = true;
        console.error(`FAIL team ${name}: logo_url DB=${gotLogo || "∅"} repo=${expLogo || "∅"}`);
      }
      const expForm = exp.form?.trim() ?? "";
      const gotForm = (dbRow.form_label ?? "").trim();
      if (gotForm !== expForm) {
        failed = true;
        console.error(`FAIL team ${name}: form_label DB=${gotForm || "∅"} repo=${expForm || "∅"}`);
      }
      if (!sameSeasons(dbRow.seasons, exp.seasons)) {
        failed = true;
        console.error(
          `FAIL team ${name}: seasons DB=${JSON.stringify(dbRow.seasons)} repo=${JSON.stringify(exp.seasons)}`,
        );
      }
    }
  }

  if (!failed) {
    console.log(
      "OK: repo and database match (matches, tournaments, teams catalog, event multiset).",
    );
  } else {
    console.error("\nFix: run `npm run db:import:website` after correcting CSV/repo, or align DB manually.");
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
