import "server-only";

import { cache } from "react";

import {
  fixtureCounts as fileFixtureCounts,
  fixtureGroups as fileFixtureGroups,
  type FixtureGroup,
  type FixtureRow,
} from "@/app/stats/fixtures-data";
import {
  getMatchTeamFromList,
  matches as fileMatches,
  type MatchRecord,
} from "@/app/stats/matches-data";
import type { MatchEvent } from "@/app/stats/match-events-data";
import type { Team } from "@/app/teams/teams-data";
import { teams as fileTeams } from "@/app/teams/teams-data";
import { createSupabaseServerClient } from "@/lib/supabase-server";

const STATS_SEASONS = [1, 2, 3] as const;

function normStr(v: unknown): string {
  if (v == null || v === "") return "";
  return String(v).trim();
}

function mapDbRowToMatchRecord(
  row: {
    roblox_match_id: string | null;
    season: number | null;
    competition: string | null;
    game_week_label: string | null;
    match_week: number | null;
    scheduled_at: string | null;
    home_score: number | null;
    away_score: number | null;
    stage: string | null;
    fft: string | null;
    referee: string | null;
    match_notes: string | null;
    home_team_id: string;
    away_team_id: string;
  },
  homeName: string,
  awayName: string,
  homeSlug: string | null,
  awaySlug: string | null,
): MatchRecord {
  const day =
    row.scheduled_at == null
      ? ""
      : String(row.scheduled_at).slice(0, 10);
  const gw =
    row.game_week_label?.trim() ||
    (row.match_week != null ? `GW${row.match_week}` : "—");
  const fftRaw = normStr(row.fft) || "No";
  const fft =
    fftRaw === "Yes" ||
    fftRaw === "Partial" ||
    fftRaw === "Mercy" ||
    fftRaw === "No"
      ? fftRaw
      : "No";

  return {
    id: row.roblox_match_id ?? "",
    season: (row.season === 1 || row.season === 2 || row.season === 3
      ? row.season
      : 1) as MatchRecord["season"],
    competition: row.competition?.trim() || "—",
    gameWeek: gw,
    date: day,
    homeTeam: homeName,
    homeSlug,
    homeScore: row.home_score ?? 0,
    awayTeam: awayName,
    awaySlug,
    awayScore: row.away_score ?? 0,
    stage: row.stage?.trim() || "Group",
    fft,
    referee: normStr(row.referee) || "—",
    notes: normStr(row.match_notes),
  };
}

function mapTeamRow(r: {
  name: string;
  abbreviation: string | null;
  slug: string | null;
  logo_url: string | null;
  form_label: string | null;
  seasons: number[] | null;
}): Team {
  return {
    name: r.name,
    short: (r.abbreviation?.trim() || r.name.slice(0, 3)).toUpperCase().slice(0, 8),
    slug: r.slug?.trim() || "",
    logo: r.logo_url?.trim() || null,
    form: r.form_label?.trim() || "",
    seasons: [...(r.seasons ?? [])].sort((a, b) => a - b),
  };
}

function buildFixtureGroupsDb(
  fixtureRowsDb: {
    fixture_code: string;
    season: number;
    competition: string;
    stage: string;
    round_order: number;
    home_team_name: string;
    away_team_name: string;
    roblox_match_id: string | null;
    match_id: string | null;
  }[],
  uuidToRoblox: Map<string, string>,
  matchesByRoblox: Map<string, MatchRecord>,
): { groups: FixtureGroup[]; templateCount: number } {
  const sorted = [...fixtureRowsDb].sort((a, b) => {
    if (a.season !== b.season) return a.season - b.season;
    if (a.competition !== b.competition)
      return a.competition.localeCompare(b.competition);
    if (a.round_order !== b.round_order)
      return a.round_order - b.round_order;
    return a.fixture_code.localeCompare(b.fixture_code);
  });

  const rows: FixtureRow[] = sorted.map((f) => {
    let m: MatchRecord | null = null;
    if (f.roblox_match_id) {
      m = matchesByRoblox.get(f.roblox_match_id) ?? null;
    } else if (f.match_id) {
      const rid = uuidToRoblox.get(f.match_id);
      if (rid) m = matchesByRoblox.get(rid) ?? null;
    }
    return {
      id: f.fixture_code,
      season: f.season,
      competition: f.competition,
      stage: f.stage,
      teamA: f.home_team_name ?? "",
      teamB: f.away_team_name ?? "",
      match: m,
    };
  });

  const ordered: FixtureGroup[] = [];
  for (const row of rows) {
    const key = `S${row.season}-${row.competition}`;
    let group = ordered.find((g) => g.key === key);
    if (!group) {
      group = {
        key,
        season: row.season,
        competition: row.competition,
        rows: [],
      };
      ordered.push(group);
    }
    group.rows.push(row);
  }

  for (const group of ordered) {
    group.rows.sort((a, b) => {
      const aDate = a.match?.date ?? "9999-99-99";
      const bDate = b.match?.date ?? "9999-99-99";
      if (aDate !== bDate) return aDate.localeCompare(bDate);
      return a.id.localeCompare(b.id);
    });
  }

  const played = rows.filter((r) => r.match !== null).length;
  const missing = rows.filter((r) => r.match === null).length;

  return {
    groups: ordered,
    templateCount: sorted.length,
  };
}

function dbEventToUi(
  robloxMatchId: string,
  eventType: string,
  teamName: string,
  details: Record<string, unknown>,
): MatchEvent | null {
  const typeMap: Record<string, MatchEvent["type"]> = {
    goal: "Goal",
    assist: "Assist",
    own_goal: "OG",
    yellow_card: "Yellow Card",
    red_card: "Red Card",
    motm: "MOTM",
  };
  const type = typeMap[eventType];
  if (!type) return null;

  const player = normStr(details.player) || "—";
  const robloxId = normStr(details.roblox_user_id) || null;
  const count = Number(details.count);
  const countN = Number.isFinite(count) && count > 0 ? count : 1;
  const notes = normStr(details.notes);
  const reasonRaw = details.reason;
  const reason =
    reasonRaw == null || reasonRaw === ""
      ? null
      : String(reasonRaw).trim() || null;

  return {
    matchId: robloxMatchId,
    type,
    team: teamName || "—",
    player,
    robloxId: robloxId || null,
    count: countN,
    reason,
    notes,
  };
}

export type SiteStatsSource = "supabase" | "files";

export type SiteStatsBundle = {
  source: SiteStatsSource;
  teams: Team[];
  fixtureGroups: FixtureGroup[];
  fixtureCounts: {
    total: number;
    played: number;
    missing: number;
    expected: number;
  };
  matchesByRobloxId: Map<string, MatchRecord>;
  allMatches: MatchRecord[];
};

export async function loadMatchEventsForRobloxId(
  robloxMatchId: string,
): Promise<MatchEvent[] | null> {
  try {
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return null;
    }
    const supabase = createSupabaseServerClient();

    const { data: mRow, error: mErr } = await supabase
      .from("matches")
      .select("id")
      .eq("roblox_match_id", robloxMatchId)
      .maybeSingle();
    if (mErr || !mRow?.id) return null;

    const { data: teamRows, error: tErr } = await supabase
      .from("teams")
      .select("id, name");
    if (tErr) return null;
    const teamNameById = new Map((teamRows ?? []).map((t) => [t.id, t.name] as const));

    const { data: evRows, error: evErr } = await supabase
      .from("match_events")
      .select("event_type, team_id, details")
      .eq("match_id", mRow.id);
    if (evErr) return null;

    const out: MatchEvent[] = [];
    for (const ev of evRows ?? []) {
      const teamName =
        ev.team_id != null ? (teamNameById.get(ev.team_id) ?? "") : "";
      const details =
        ev.details &&
        typeof ev.details === "object" &&
        !Array.isArray(ev.details)
          ? (ev.details as Record<string, unknown>)
          : {};
      const ui = dbEventToUi(
        robloxMatchId,
        String(ev.event_type),
        teamName,
        details,
      );
      if (ui) out.push(ui);
    }
    return out;
  } catch {
    return null;
  }
}

async function tryLoadStatsFromSupabase(): Promise<SiteStatsBundle | null> {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return null;
  }

  const supabase = createSupabaseServerClient();

  const { data: teamRows, error: teamErr } = await supabase
    .from("teams")
    .select("id, name, abbreviation, slug, logo_url, form_label, seasons")
    .order("name", { ascending: true });

  if (teamErr || !teamRows?.length) return null;

  const teams = teamRows.map(mapTeamRow);
  const teamById = new Map(
    teamRows.map(
      (t) =>
        [t.id, { name: t.name, slug: t.slug?.trim() || null }] as const,
    ),
  );

  const { data: matchRows, error: mErr } = await supabase
    .from("matches")
    .select(
      "id, roblox_match_id, season, competition, game_week_label, match_week, scheduled_at, home_team_id, away_team_id, home_score, away_score, stage, fft, referee, match_notes",
    );

  if (mErr || !matchRows?.length) return null;

  const matchesByRoblox = new Map<string, MatchRecord>();
  const uuidToRoblox = new Map<string, string>();
  const allMatches: MatchRecord[] = [];

  for (const row of matchRows) {
    if (!row.roblox_match_id) continue;
    const home = teamById.get(row.home_team_id);
    const away = teamById.get(row.away_team_id);
    if (!home || !away) continue;
    const rec = mapDbRowToMatchRecord(
      row,
      home.name,
      away.name,
      home.slug,
      away.slug,
    );
    if (!rec.id) continue;
    matchesByRoblox.set(rec.id, rec);
    uuidToRoblox.set(row.id, rec.id);
    allMatches.push(rec);
  }

  allMatches.sort((a, b) =>
    a.date === b.date ? a.id.localeCompare(b.id) : a.date.localeCompare(b.date),
  );

  const { data: fxRows, error: fxErr } = await supabase
    .from("fixtures")
    .select(
      "fixture_code, season, competition, stage, round_order, home_team_name, away_team_name, roblox_match_id, match_id",
    )
    .in("season", [...STATS_SEASONS]);

  if (fxErr || !fxRows?.length) return null;

  const { groups, templateCount } = buildFixtureGroupsDb(
    fxRows,
    uuidToRoblox,
    matchesByRoblox,
  );

  const played = groups.reduce(
    (n, g) => n + g.rows.filter((r) => r.match !== null).length,
    0,
  );
  const total = groups.reduce((n, g) => n + g.rows.length, 0);
  const missing = total - played;

  return {
    source: "supabase",
    teams,
    fixtureGroups: groups,
    fixtureCounts: {
      total,
      played,
      missing,
      expected: templateCount,
    },
    matchesByRobloxId: matchesByRoblox,
    allMatches,
  };
}

function buildFileStatsBundle(): SiteStatsBundle {
  const matchesByRoblox = new Map(fileMatches.map((m) => [m.id, m]));
  return {
    source: "files",
    teams: fileTeams,
    fixtureGroups: fileFixtureGroups,
    fixtureCounts: fileFixtureCounts,
    matchesByRobloxId: matchesByRoblox,
    allMatches: fileMatches,
  };
}

async function resolveSiteStatsBundle(): Promise<SiteStatsBundle> {
  const db = await tryLoadStatsFromSupabase();
  if (db) return db;
  return buildFileStatsBundle();
}

export const getSiteStatsBundle = cache(resolveSiteStatsBundle);

export async function getTeamsCatalog(): Promise<{
  teams: Team[];
  source: SiteStatsSource;
}> {
  const bundle = await getSiteStatsBundle();

  if (bundle.source !== "supabase") {
    return { teams: bundle.teams, source: bundle.source };
  }

  // Supabase only has rows that were migrated/imported. Merge repo `teams-data`
  // entries missing in DB (e.g. new S3 nations before `db push` / import).
  // Union `seasons` with the file catalogue so DB rows that dropped `{3}` still
  // show in the Season 3 World Cup pool (e.g. Canada).
  const bySlug = new Map<string, Team>();
  for (const t of bundle.teams) {
    const s = t.slug?.trim();
    if (s) bySlug.set(s, t);
  }
  for (const t of fileTeams) {
    const s = t.slug?.trim();
    if (!s) continue;
    const existing = bySlug.get(s);
    if (!existing) {
      bySlug.set(s, t);
      continue;
    }
    const seasonSet = new Set<number>([...existing.seasons, ...t.seasons]);
    bySlug.set(s, {
      ...existing,
      seasons: [...seasonSet].sort((a, b) => a - b),
    });
  }

  const teams = [...bySlug.values()].sort((a, b) =>
    a.name.localeCompare(b.name),
  );
  return { teams, source: bundle.source };
}

export function getMatchTeamResolver(teams: Team[]) {
  return (slug: string | null, name: string) =>
    getMatchTeamFromList(teams, slug, name);
}

export async function getMatchRecordByRobloxId(
  id: string,
): Promise<MatchRecord | null> {
  const bundle = await getSiteStatsBundle();
  return bundle.matchesByRobloxId.get(id) ?? null;
}

export async function getAllRobloxMatchIds(): Promise<string[]> {
  const bundle = await getSiteStatsBundle();
  return [...bundle.matchesByRobloxId.keys()].sort();
}

export async function getAllTeamSlugs(): Promise<string[]> {
  const { teams } = await getTeamsCatalog();
  return teams
    .map((t) => t.slug)
    .filter((s) => s.length > 0)
    .sort();
}

export async function getTeamBySlugFromDb(
  slug: string,
): Promise<Team | undefined> {
  const { teams } = await getTeamsCatalog();
  return teams.find((t) => t.slug === slug);
}
