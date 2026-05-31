import type { MatchRecord } from "@/app/stats/matches-data";
import {
  S3_WORLD_CUP_GROUPS,
  S3_WORLD_CUP_GROUP_LETTERS,
  type S3WorldCupGroupLetter,
} from "@/lib/s3-world-cup-groups";
import {
  filterGroupMatches,
  type StandingRow,
} from "@/lib/stats-tournaments";

export type WorldCupGroupMatchSummary = {
  id: string;
  date: string;
  gameWeek: string;
  homeTeam: string;
  homeSlug: string | null;
  awayTeam: string;
  awaySlug: string | null;
  homeScore: number;
  awayScore: number;
  played: boolean;
};

export type WorldCupGroupBundle = {
  letter: S3WorldCupGroupLetter;
  standings: StandingRow[];
  matches: WorldCupGroupMatchSummary[];
};

function isPlayedMatch(m: MatchRecord): boolean {
  return m.status !== "scheduled";
}

function slugSetForGroup(letter: S3WorldCupGroupLetter): Set<string> {
  return new Set(S3_WORLD_CUP_GROUPS[letter]);
}

export function worldCupGroupMatches(
  allMatches: MatchRecord[],
  letter: S3WorldCupGroupLetter,
): MatchRecord[] {
  const slugs = slugSetForGroup(letter);
  return filterGroupMatches(allMatches, 3, "World Cup")
    .filter(
      (m) =>
        m.homeSlug &&
        m.awaySlug &&
        slugs.has(m.homeSlug) &&
        slugs.has(m.awaySlug),
    )
    .sort((a, b) =>
      a.date === b.date ? a.id.localeCompare(b.id) : a.date.localeCompare(b.date),
    );
}

export function buildWorldCupGroupBundle(
  letter: S3WorldCupGroupLetter,
  allMatches: MatchRecord[],
  teamNamesBySlug: Record<string, string>,
): WorldCupGroupBundle {
  const slugs = S3_WORLD_CUP_GROUPS[letter];
  const groupMatches = worldCupGroupMatches(allMatches, letter);
  const playedMatches = groupMatches.filter(isPlayedMatch);

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

  const bySlug = new Map<string, Acc>();
  for (const slug of slugs) {
    bySlug.set(slug, {
      team: teamNamesBySlug[slug] ?? slug,
      slug,
      played: 0,
      won: 0,
      drawn: 0,
      lost: 0,
      gf: 0,
      ga: 0,
    });
  }

  const touch = (slug: string | null, name: string): Acc | null => {
    if (!slug || !bySlug.has(slug)) return null;
    const row = bySlug.get(slug)!;
    if (!row.team || row.team === slug) row.team = name;
    return row;
  };

  for (const m of playedMatches) {
    const h = touch(m.homeSlug, m.homeTeam);
    const a = touch(m.awaySlug, m.awayTeam);
    if (!h || !a) continue;

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

  const standings: StandingRow[] = [...bySlug.values()].map((r) => ({
    ...r,
    gd: r.gf - r.ga,
    points: r.won * 3 + r.drawn,
  }));

  standings.sort((x, y) =>
    y.points !== x.points
      ? y.points - x.points
      : y.gd !== x.gd
        ? y.gd - x.gd
        : y.gf !== x.gf
          ? y.gf - x.gf
          : x.team.localeCompare(y.team),
  );

  const drawOrder = new Map(slugs.map((slug, idx) => [slug, idx]));
  if (playedMatches.length === 0) {
    standings.sort(
      (a, b) =>
        (drawOrder.get(a.slug ?? "") ?? 99) - (drawOrder.get(b.slug ?? "") ?? 99),
    );
  }

  const matches: WorldCupGroupMatchSummary[] = groupMatches.map((m) => ({
    id: m.id,
    date: m.date,
    gameWeek: m.gameWeek,
    homeTeam: m.homeTeam,
    homeSlug: m.homeSlug,
    awayTeam: m.awayTeam,
    awaySlug: m.awaySlug,
    homeScore: m.homeScore,
    awayScore: m.awayScore,
    played: isPlayedMatch(m),
  }));

  return { letter, standings, matches };
}

export function buildAllWorldCupGroupBundles(
  allMatches: MatchRecord[],
  teamNamesBySlug: Record<string, string>,
): Record<S3WorldCupGroupLetter, WorldCupGroupBundle> {
  return Object.fromEntries(
    S3_WORLD_CUP_GROUP_LETTERS.map((letter) => [
      letter,
      buildWorldCupGroupBundle(letter, allMatches, teamNamesBySlug),
    ]),
  ) as Record<S3WorldCupGroupLetter, WorldCupGroupBundle>;
}
