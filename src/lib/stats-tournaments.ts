import type { MatchRecord } from "@/app/stats/matches-data";

export type StandingRow = {
  team: string;
  slug: string | null;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  gf: number;
  ga: number;
  gd: number;
  points: number;
};

const KNOCKOUT_STAGE_RANK: Record<string, number> = {
  "Round of 16": 1,
  "Round Of 16": 1,
  "Quarter-Final": 2,
  "Semi-Final": 3,
  "Third Place": 4,
  Final: 5,
};

export function knockoutStageSortKey(stage: string): number {
  return KNOCKOUT_STAGE_RANK[stage] ?? 50;
}

/** Group-stage matches only (league tables). */
export function filterGroupMatches(
  matches: MatchRecord[],
  season: number,
  competition: string,
): MatchRecord[] {
  return matches.filter(
    (m) =>
      m.season === season &&
      m.competition === competition &&
      m.stage.trim().toLowerCase() === "group",
  );
}

/** Knock-out matches (not group / league). */
export function filterKnockoutMatches(
  matches: MatchRecord[],
  season: number,
  competition: string,
): MatchRecord[] {
  return matches.filter(
    (m) =>
      m.season === season &&
      m.competition === competition &&
      m.stage.trim().toLowerCase() !== "group",
  );
}

/** Group-stage matches with a recorded result (not upcoming 0–0 placeholders). */
export function isCompletedGroupMatch(m: MatchRecord): boolean {
  return m.status === "completed";
}

export function computeGroupStandings(
  matches: MatchRecord[],
  season: number,
  competition: string,
): StandingRow[] {
  const relevant = filterGroupMatches(matches, season, competition).filter(
    isCompletedGroupMatch,
  );
  if (relevant.length === 0) return [];

  type Acc = {
    team: string;
    slug: string | null;
    played: number;
    won: number;
    drawn: number;
    lost: number;
    gf: number;
    ga: number;
  };

  const byTeam = new Map<string, Acc>();

  const touch = (name: string, slug: string | null) => {
    if (!byTeam.has(name)) {
      byTeam.set(name, {
        team: name,
        slug,
        played: 0,
        won: 0,
        drawn: 0,
        lost: 0,
        gf: 0,
        ga: 0,
      });
    }
    return byTeam.get(name)!;
  };

  for (const m of relevant) {
    const h = touch(m.homeTeam, m.homeSlug);
    const a = touch(m.awayTeam, m.awaySlug);
    h.played += 1;
    a.played += 1;
    h.gf += m.homeScore;
    h.ga += m.awayScore;
    a.gf += m.awayScore;
    a.ga += m.homeScore;

    if (m.homeScore > m.awayScore) {
      h.won += 1;
      a.lost += 1;
    } else if (m.homeScore < m.awayScore) {
      a.won += 1;
      h.lost += 1;
    } else {
      h.drawn += 1;
      a.drawn += 1;
    }
  }

  const rows: StandingRow[] = [...byTeam.values()].map((r) => ({
    ...r,
    gd: r.gf - r.ga,
    points: r.won * 3 + r.drawn,
  }));

  rows.sort((x, y) =>
    y.points !== x.points
      ? y.points - x.points
      : y.gd !== x.gd
        ? y.gd - x.gd
        : y.gf !== x.gf
          ? y.gf - x.gf
          : x.team.localeCompare(y.team),
  );

  return rows;
}

export type KnockoutRound = {
  stage: string;
  matches: MatchRecord[];
};

export function buildKnockoutRounds(
  matches: MatchRecord[],
  season: number,
  competition: string,
): KnockoutRound[] {
  const relevant = filterKnockoutMatches(matches, season, competition);
  if (relevant.length === 0) return [];

  const byStage = new Map<string, MatchRecord[]>();
  for (const m of relevant) {
    const st = m.stage.trim() || "Knockout";
    const list = byStage.get(st) ?? [];
    list.push(m);
    byStage.set(st, list);
  }

  for (const list of byStage.values()) {
    list.sort((a, b) =>
      a.date === b.date ? a.id.localeCompare(b.id) : a.date.localeCompare(b.date),
    );
  }

  const rounds: KnockoutRound[] = [...byStage.entries()].map(([stage, ms]) => ({
    stage,
    matches: ms,
  }));

  rounds.sort(
    (a, b) =>
      knockoutStageSortKey(a.stage) - knockoutStageSortKey(b.stage) ||
      a.stage.localeCompare(b.stage),
  );

  return rounds;
}

export type CompetitionChampion = {
  team: string;
  slug: string | null;
  /** "knockout" → won a Final; "league" → topped the standings. */
  source: "knockout" | "league";
};

/**
 * Determine the champion of a (season, competition).
 *
 * Knockout final winner takes precedence over league standings — handles
 * cup competitions and World-Cup-style mixed formats. Falls back to the
 * top of the standings for league-only competitions, or returns null when
 * the final hasn't produced a clear winner and there are no standings.
 */
export function getCompetitionChampion(
  standings: StandingRow[],
  rounds: KnockoutRound[],
): CompetitionChampion | null {
  const finalRound = rounds.find((r) => r.stage.trim().toLowerCase() === "final");
  if (finalRound && finalRound.matches.length === 1) {
    const m = finalRound.matches[0]!;
    if (m.homeScore !== m.awayScore) {
      const homeWon = m.homeScore > m.awayScore;
      return {
        team: homeWon ? m.homeTeam : m.awayTeam,
        slug: homeWon ? m.homeSlug : m.awaySlug,
        source: "knockout",
      };
    }
  }
  if (standings.length > 0) {
    const top = standings[0]!;
    return { team: top.team, slug: top.slug, source: "league" };
  }
  return null;
}

/** Distinct (season, competition) pairs that have at least one played match. */
export function competitionKeysWithResults(
  allMatches: MatchRecord[],
): { season: number; competition: string }[] {
  const seen = new Set<string>();
  const out: { season: number; competition: string }[] = [];
  for (const m of allMatches) {
    const comp = m.competition?.trim();
    if (!comp || comp === "—") continue;
    const key = `${m.season}|${comp}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ season: m.season, competition: comp });
  }
  out.sort((a, b) =>
    a.season !== b.season
      ? a.season - b.season
      : a.competition.localeCompare(b.competition),
  );
  return out;
}

export type CompetitionKey = { season: number; competition: string };

function competitionKey(season: number, competition: string): string {
  return `${season}|${competition.trim()}`;
}

function matchInstantMs(m: MatchRecord): number | null {
  if (m.scheduledAt) {
    const t = Date.parse(m.scheduledAt);
    if (Number.isFinite(t)) return t;
  }
  if (m.date?.trim()) {
    const t = Date.parse(`${m.date.trim()}T12:00:00Z`);
    if (Number.isFinite(t)) return t;
  }
  return null;
}

function isUpcomingMatch(m: MatchRecord, now: number): boolean {
  if (m.status === "scheduled") return true;
  if (m.status === "completed" || m.status === "cancelled") return false;
  const t = matchInstantMs(m);
  return t != null && t >= now;
}

/**
 * Active / nearest competition first — e.g. S3 World Cup before archived S1/S2 tables.
 * Competitions with upcoming fixtures rank above finished-only slates.
 */
export function sortCompetitionsByCloseness(
  keys: CompetitionKey[],
  allMatches: MatchRecord[],
  nowMs: number = Date.now(),
): CompetitionKey[] {
  const byKey = new Map<string, MatchRecord[]>();
  for (const m of allMatches) {
    const comp = m.competition?.trim();
    if (!comp || comp === "—") continue;
    const key = competitionKey(m.season, comp);
    const list = byKey.get(key) ?? [];
    list.push(m);
    byKey.set(key, list);
  }

  const ARCHIVE_OFFSET = 1_000_000_000_000;

  function score({ season, competition }: CompetitionKey): number {
    const matches = byKey.get(competitionKey(season, competition)) ?? [];
    if (matches.length === 0) return ARCHIVE_OFFSET * 2;

    let nearestUpcoming = Number.POSITIVE_INFINITY;
    let nearestPast = Number.POSITIVE_INFINITY;

    for (const m of matches) {
      const t = matchInstantMs(m);
      if (t == null) continue;

      if (isUpcomingMatch(m, nowMs)) {
        const delta = Math.max(0, t - nowMs);
        if (delta < nearestUpcoming) nearestUpcoming = delta;
      } else {
        const delta = Math.abs(t - nowMs);
        if (delta < nearestPast) nearestPast = delta;
      }
    }

    if (nearestUpcoming !== Number.POSITIVE_INFINITY) return nearestUpcoming;
    if (nearestPast !== Number.POSITIVE_INFINITY) return ARCHIVE_OFFSET + nearestPast;
    return ARCHIVE_OFFSET * 2;
  }

  return [...keys].sort((a, b) => {
    const sa = score(a);
    const sb = score(b);
    if (sa !== sb) return sa - sb;
    if (a.season !== b.season) return b.season - a.season;
    return a.competition.localeCompare(b.competition);
  });
}
