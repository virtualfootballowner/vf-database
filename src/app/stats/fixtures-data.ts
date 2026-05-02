import { matches, type MatchRecord } from "./matches-data";

export type Fixture = {
  id: string;
  season: number;
  competition: string;
  stage: string;
  teamA: string;
  teamB: string;
};

export type FixtureRow = Fixture & {
  match: MatchRecord | null;
};

export type FixtureScheduleRaw = [
  season: 1 | 2 | 3,
  competition: string,
  stage: string,
  id: string,
  a: string,
  b: string,
];

/** Canonical S1/S2 schedule rows (also used by `db:seed:fixtures`). */
export const FIXTURE_SCHEDULE_RAW: readonly FixtureScheduleRaw[] = [
  [1, "EuroLeague", "Group", "S1-EL-01", "Newport", "Nottingham"],
  [1, "EuroLeague", "Group", "S1-EL-02", "Newport", "Milton"],
  [1, "EuroLeague", "Group", "S1-EL-03", "Newport", "Newham"],
  [1, "EuroLeague", "Group", "S1-EL-04", "Newport", "Stafford"],
  [1, "EuroLeague", "Group", "S1-EL-05", "Newport", "Viola"],
  [1, "EuroLeague", "Group", "S1-EL-06", "Newport", "Andover"],
  [1, "EuroLeague", "Group", "S1-EL-07", "Newport", "Eltham"],
  [1, "EuroLeague", "Group", "S1-EL-08", "Nottingham", "Milton"],
  [1, "EuroLeague", "Group", "S1-EL-09", "Nottingham", "Newham"],
  [1, "EuroLeague", "Group", "S1-EL-10", "Nottingham", "Stafford"],
  [1, "EuroLeague", "Group", "S1-EL-11", "Nottingham", "Viola"],
  [1, "EuroLeague", "Group", "S1-EL-12", "Nottingham", "Andover"],
  [1, "EuroLeague", "Group", "S1-EL-13", "Nottingham", "Eltham"],
  [1, "EuroLeague", "Group", "S1-EL-14", "Milton", "Newham"],
  [1, "EuroLeague", "Group", "S1-EL-15", "Milton", "Stafford"],
  [1, "EuroLeague", "Group", "S1-EL-16", "Milton", "Viola"],
  [1, "EuroLeague", "Group", "S1-EL-17", "Milton", "Andover"],
  [1, "EuroLeague", "Group", "S1-EL-18", "Milton", "Eltham"],
  [1, "EuroLeague", "Group", "S1-EL-19", "Newham", "Stafford"],
  [1, "EuroLeague", "Group", "S1-EL-20", "Newham", "Viola"],
  [1, "EuroLeague", "Group", "S1-EL-21", "Newham", "Andover"],
  [1, "EuroLeague", "Group", "S1-EL-22", "Newham", "Eltham"],
  [1, "EuroLeague", "Group", "S1-EL-23", "Stafford", "Viola"],
  [1, "EuroLeague", "Group", "S1-EL-24", "Stafford", "Andover"],
  [1, "EuroLeague", "Group", "S1-EL-25", "Stafford", "Eltham"],
  [1, "EuroLeague", "Group", "S1-EL-26", "Viola", "Andover"],
  [1, "EuroLeague", "Group", "S1-EL-27", "Viola", "Eltham"],
  [1, "EuroLeague", "Group", "S1-EL-28", "Andover", "Eltham"],
  [1, "EuroLeague", "Quarter-Final", "S1-QF-1", "", ""],
  [1, "EuroLeague", "Quarter-Final", "S1-QF-2", "", ""],
  [1, "EuroLeague", "Quarter-Final", "S1-QF-3", "", ""],
  [1, "EuroLeague", "Quarter-Final", "S1-QF-4", "", ""],
  [1, "EuroLeague", "Semi-Final", "S1-SF-1", "", ""],
  [1, "EuroLeague", "Semi-Final", "S1-SF-2", "", ""],
  [1, "EuroLeague", "Final", "S1-F", "", ""],
  [2, "British Premier", "Group", "S2-BP-01", "Milton", "Eltham"],
  [2, "British Premier", "Group", "S2-BP-02", "Milton", "Newport"],
  [2, "British Premier", "Group", "S2-BP-03", "Milton", "Nottingham"],
  [2, "British Premier", "Group", "S2-BP-04", "Milton", "Newham"],
  [2, "British Premier", "Group", "S2-BP-05", "Milton", "Andover"],
  [2, "British Premier", "Group", "S2-BP-06", "Milton", "Canterbury"],
  [2, "British Premier", "Group", "S2-BP-07", "Milton", "Stanford"],
  [2, "British Premier", "Group", "S2-BP-08", "Eltham", "Newport"],
  [2, "British Premier", "Group", "S2-BP-09", "Eltham", "Nottingham"],
  [2, "British Premier", "Group", "S2-BP-10", "Eltham", "Newham"],
  [2, "British Premier", "Group", "S2-BP-11", "Eltham", "Andover"],
  [2, "British Premier", "Group", "S2-BP-12", "Eltham", "Canterbury"],
  [2, "British Premier", "Group", "S2-BP-13", "Eltham", "Stanford"],
  [2, "British Premier", "Group", "S2-BP-14", "Newport", "Nottingham"],
  [2, "British Premier", "Group", "S2-BP-15", "Newport", "Newham"],
  [2, "British Premier", "Group", "S2-BP-16", "Newport", "Andover"],
  [2, "British Premier", "Group", "S2-BP-17", "Newport", "Canterbury"],
  [2, "British Premier", "Group", "S2-BP-18", "Newport", "Stanford"],
  [2, "British Premier", "Group", "S2-BP-19", "Nottingham", "Newham"],
  [2, "British Premier", "Group", "S2-BP-20", "Nottingham", "Andover"],
  [2, "British Premier", "Group", "S2-BP-21", "Nottingham", "Canterbury"],
  [2, "British Premier", "Group", "S2-BP-22", "Nottingham", "Stanford"],
  [2, "British Premier", "Group", "S2-BP-23", "Newham", "Andover"],
  [2, "British Premier", "Group", "S2-BP-24", "Newham", "Canterbury"],
  [2, "British Premier", "Group", "S2-BP-25", "Newham", "Stanford"],
  [2, "British Premier", "Group", "S2-BP-26", "Andover", "Canterbury"],
  [2, "British Premier", "Group", "S2-BP-27", "Andover", "Stanford"],
  [2, "British Premier", "Group", "S2-BP-28", "Canterbury", "Stanford"],
  [2, "Serie Italia", "Group", "S2-SI-01", "Milano", "DDG"],
  [2, "Serie Italia", "Group", "S2-SI-02", "Milano", "Tretorre"],
  [2, "Serie Italia", "Group", "S2-SI-03", "Milano", "Sassari"],
  [2, "Serie Italia", "Group", "S2-SI-04", "Milano", "Casole"],
  [2, "Serie Italia", "Group", "S2-SI-05", "Milano", "Viola"],
  [2, "Serie Italia", "Group", "S2-SI-06", "Milano", "Cartiginia"],
  [2, "Serie Italia", "Group", "S2-SI-07", "Milano", "Venezia"],
  [2, "Serie Italia", "Group", "S2-SI-08", "DDG", "Tretorre"],
  [2, "Serie Italia", "Group", "S2-SI-09", "DDG", "Sassari"],
  [2, "Serie Italia", "Group", "S2-SI-10", "DDG", "Casole"],
  [2, "Serie Italia", "Group", "S2-SI-11", "DDG", "Viola"],
  [2, "Serie Italia", "Group", "S2-SI-12", "DDG", "Cartiginia"],
  [2, "Serie Italia", "Group", "S2-SI-13", "DDG", "Venezia"],
  [2, "Serie Italia", "Group", "S2-SI-14", "Tretorre", "Sassari"],
  [2, "Serie Italia", "Group", "S2-SI-15", "Tretorre", "Casole"],
  [2, "Serie Italia", "Group", "S2-SI-16", "Tretorre", "Viola"],
  [2, "Serie Italia", "Group", "S2-SI-17", "Tretorre", "Cartiginia"],
  [2, "Serie Italia", "Group", "S2-SI-18", "Tretorre", "Venezia"],
  [2, "Serie Italia", "Group", "S2-SI-19", "Sassari", "Casole"],
  [2, "Serie Italia", "Group", "S2-SI-20", "Sassari", "Viola"],
  [2, "Serie Italia", "Group", "S2-SI-21", "Sassari", "Cartiginia"],
  [2, "Serie Italia", "Group", "S2-SI-22", "Sassari", "Venezia"],
  [2, "Serie Italia", "Group", "S2-SI-23", "Casole", "Viola"],
  [2, "Serie Italia", "Group", "S2-SI-24", "Casole", "Cartiginia"],
  [2, "Serie Italia", "Group", "S2-SI-25", "Casole", "Venezia"],
  [2, "Serie Italia", "Group", "S2-SI-26", "Viola", "Cartiginia"],
  [2, "Serie Italia", "Group", "S2-SI-27", "Viola", "Venezia"],
  [2, "Serie Italia", "Group", "S2-SI-28", "Cartiginia", "Venezia"],
];

const fixtures: Fixture[] = FIXTURE_SCHEDULE_RAW.map(([season, competition, stage, id, teamA, teamB]) => ({
  id,
  season,
  competition,
  stage,
  teamA,
  teamB,
}));

function buildResolvedFixtures(): FixtureRow[] {
  const used = new Set<string>();
  const resolved: FixtureRow[] = [];

  for (const fixture of fixtures) {
    const hasTeams = Boolean(fixture.teamA) && Boolean(fixture.teamB);
    let match: MatchRecord | undefined;

    if (hasTeams) {
      match = matches.find(
        (m) =>
          !used.has(m.id) &&
          m.season === fixture.season &&
          ((m.homeTeam === fixture.teamA && m.awayTeam === fixture.teamB) ||
            (m.homeTeam === fixture.teamB && m.awayTeam === fixture.teamA)),
      );
    } else {
      match = matches.find(
        (m) =>
          !used.has(m.id) &&
          m.season === fixture.season &&
          m.stage === fixture.stage,
      );
    }

    if (match) used.add(match.id);
    resolved.push({ ...fixture, match: match ?? null });
  }

  for (const m of matches) {
    if (used.has(m.id)) continue;
    resolved.push({
      id: m.id,
      season: m.season,
      competition: m.competition,
      stage: m.stage,
      teamA: m.homeTeam,
      teamB: m.awayTeam,
      match: m,
    });
  }

  return resolved;
}

export const fixtureRows: FixtureRow[] = buildResolvedFixtures();

export const fixtureCounts = {
  total: fixtureRows.length,
  played: fixtureRows.filter((r) => r.match !== null).length,
  missing: fixtureRows.filter((r) => r.match === null).length,
  expected: fixtures.length,
};

export type FixtureGroup = {
  key: string;
  season: number;
  competition: string;
  rows: FixtureRow[];
};

export const fixtureGroups: FixtureGroup[] = (() => {
  const ordered: FixtureGroup[] = [];
  for (const row of fixtureRows) {
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

  return ordered;
})();

/** Row shape for `public.fixtures` seeds (S1/S2). */
export type FixtureDbSeedRow = {
  season: number;
  competition: string;
  fixture_code: string;
  stage: string;
  round_order: number;
  group_code: string | null;
  home_team_name: string;
  away_team_name: string;
  roblox_match_id: string | null;
  metadata: Record<string, unknown>;
};

function structureKindForS1S2(season: number, competition: string): string {
  if (season === 1 && competition === "EuroLeague") {
    return "s1_euroleague_round_robin_knockout";
  }
  if (season === 2) return "s2_multi_league";
  return "league";
}

/**
 * Builds DB upsert rows matching `buildResolvedFixtures`, with `roblox_match_id`
 * filled when a `MatchRecord` is paired.
 */
export function buildS1S2FixtureDbSeedRows(allMatches: MatchRecord[]): FixtureDbSeedRow[] {
  const used = new Set<string>();
  const out: FixtureDbSeedRow[] = [];
  let order = 0;

  for (const fixture of fixtures) {
    order += 1;
    const hasTeams = Boolean(fixture.teamA) && Boolean(fixture.teamB);
    let match: MatchRecord | undefined;

    if (hasTeams) {
      match = allMatches.find(
        (m) =>
          !used.has(m.id) &&
          m.season === fixture.season &&
          ((m.homeTeam === fixture.teamA && m.awayTeam === fixture.teamB) ||
            (m.homeTeam === fixture.teamB && m.awayTeam === fixture.teamA)),
      );
    } else {
      match = allMatches.find(
        (m) =>
          !used.has(m.id) &&
          m.season === fixture.season &&
          m.stage === fixture.stage,
      );
    }

    if (match) used.add(match.id);
    out.push({
      season: fixture.season,
      competition: fixture.competition,
      fixture_code: fixture.id,
      stage: fixture.stage,
      round_order: order,
      group_code: null,
      home_team_name: fixture.teamA,
      away_team_name: fixture.teamB,
      roblox_match_id: match?.id ?? null,
      metadata: {
        structure_kind: structureKindForS1S2(fixture.season, fixture.competition),
      },
    });
  }

  for (const m of allMatches) {
    if (used.has(m.id)) continue;
    order += 1;
    out.push({
      season: m.season,
      competition: m.competition,
      fixture_code: m.id,
      stage: m.stage,
      round_order: order,
      group_code: null,
      home_team_name: m.homeTeam,
      away_team_name: m.awayTeam,
      roblox_match_id: m.id,
      metadata: {
        structure_kind: structureKindForS1S2(m.season, m.competition),
        appended: true,
      },
    });
  }

  return out;
}
