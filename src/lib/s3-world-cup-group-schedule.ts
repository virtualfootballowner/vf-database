/**
 * Season 3 World Cup · group-stage schedule (GW1–GW3).
 * Pairings are seeded-shuffled per group; kickoffs 18:00–22:00 BST.
 */

import { teams, type Team } from "@/app/teams/teams-data";
import {
  buildKickoffGrid,
  GW1_KICKOFF_SLOTS_BST,
  WEEKEND_KICKOFF_SLOTS_BST,
} from "@/lib/wc-fixture-kickoff";

import {
  S3_WORLD_CUP_GROUPS,
  S3_WORLD_CUP_GROUP_LETTERS,
  type S3WorldCupGroupLetter,
} from "@/lib/s3-world-cup-groups";

export const S3_WORLD_CUP_STADIUM_TBD = "TBD";

/** Pair indices for a single round-robin of 4 teams (6 games). */
const FOUR_TEAM_ROUND_ROBIN: [number, number][] = [
  [0, 1],
  [2, 3],
  [0, 2],
  [1, 3],
  [0, 3],
  [1, 2],
];

export type S3WorldCupGroupFixture = {
  fixtureCode: string;
  group: S3WorldCupGroupLetter;
  matchInGroup: number;
  gameWeek: 1 | 2 | 3;
  gameWeekLabel: "GW1" | "GW2" | "GW3";
  homeSlug: string;
  awaySlug: string;
  homeTeamName: string;
  awayTeamName: string;
  /** ISO-8601 UTC kickoff (display in BST via formatWcKickoff) */
  scheduledAt: string;
  stadium: typeof S3_WORLD_CUP_STADIUM_TBD;
};

const SLUG_TO_TEAM = new Map<string, Team>(
  teams.filter((t) => t.slug).map((t) => [t.slug, t]),
);

function hashSeed(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function seededShuffle<T>(items: readonly T[], seed: string): T[] {
  const arr = [...items];
  const rng = mulberry32(hashSeed(seed));
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function teamNameForSlug(slug: string): string {
  return SLUG_TO_TEAM.get(slug)?.name ?? slug;
}

/** GW1 · Fri 5 – Sun 7 Jun 2026 · 18:00–21:30 BST. */
const GW1_KICKOFFS_UTC = buildKickoffGrid(
  ["2026-06-05", "2026-06-06", "2026-06-07"],
  GW1_KICKOFF_SLOTS_BST,
);

/** GW2 · Sat 13 – Sun 14 Jun 2026 · 18:00–21:45 BST. */
const GW2_KICKOFFS_UTC = buildKickoffGrid(
  ["2026-06-13", "2026-06-14"],
  WEEKEND_KICKOFF_SLOTS_BST,
);

/** GW3 · Sat 20 – Sun 21 Jun 2026 · 18:00–21:45 BST. */
const GW3_KICKOFFS_UTC = buildKickoffGrid(
  ["2026-06-20", "2026-06-21"],
  WEEKEND_KICKOFF_SLOTS_BST,
);

const KICKOFFS_BY_GW: Record<1 | 2 | 3, readonly string[]> = {
  1: GW1_KICKOFFS_UTC,
  2: GW2_KICKOFFS_UTC,
  3: GW3_KICKOFFS_UTC,
};

function buildRawGroupFixtures(): Omit<
  S3WorldCupGroupFixture,
  "scheduledAt" | "stadium"
>[] {
  const raw: Omit<S3WorldCupGroupFixture, "scheduledAt" | "stadium">[] = [];

  for (const group of S3_WORLD_CUP_GROUP_LETTERS) {
    const pool = S3_WORLD_CUP_GROUPS[group];
    const shuffled = seededShuffle(pool, `vf-s3-wc-2026-group-${group}`);

    FOUR_TEAM_ROUND_ROBIN.forEach(([hi, ai], idx) => {
      const matchInGroup = idx + 1;
      const gameWeek = (matchInGroup <= 2 ? 1 : matchInGroup <= 4 ? 2 : 3) as
        | 1
        | 2
        | 3;
      const homeSlug = shuffled[hi]!;
      const awaySlug = shuffled[ai]!;

      raw.push({
        fixtureCode: `S3-WC-G-${group}-${String(matchInGroup).padStart(2, "0")}`,
        group,
        matchInGroup,
        gameWeek,
        gameWeekLabel: `GW${gameWeek}` as "GW1" | "GW2" | "GW3",
        homeSlug,
        awaySlug,
        homeTeamName: teamNameForSlug(homeSlug),
        awayTeamName: teamNameForSlug(awaySlug),
      });
    });
  }

  return raw;
}

function assignKickoffs(
  raw: Omit<S3WorldCupGroupFixture, "scheduledAt" | "stadium">[],
): S3WorldCupGroupFixture[] {
  const gwSlot: Record<1 | 2 | 3, number> = { 1: 0, 2: 0, 3: 0 };
  const sorted = [...raw].sort((a, b) => {
    if (a.gameWeek !== b.gameWeek) return a.gameWeek - b.gameWeek;
    if (a.group !== b.group) return a.group.localeCompare(b.group);
    return a.matchInGroup - b.matchInGroup;
  });

  return sorted.map((row) => {
    const slots = KICKOFFS_BY_GW[row.gameWeek];
    const slot = gwSlot[row.gameWeek];
    gwSlot[row.gameWeek] = slot + 1;
    const scheduledAt = slots[slot] ?? slots[slots.length - 1]!;

    return {
      ...row,
      scheduledAt,
      stadium: S3_WORLD_CUP_STADIUM_TBD,
    };
  });
}

export const S3_WORLD_CUP_GROUP_FIXTURES: S3WorldCupGroupFixture[] =
  assignKickoffs(buildRawGroupFixtures());

export function s3WorldCupFixturesForGameWeek(
  gw: 1 | 2 | 3,
): S3WorldCupGroupFixture[] {
  return S3_WORLD_CUP_GROUP_FIXTURES.filter((f) => f.gameWeek === gw);
}

export function s3WorldCupUpcomingFixtures(limit = 12): S3WorldCupGroupFixture[] {
  const now = Date.now();
  return S3_WORLD_CUP_GROUP_FIXTURES.filter(
    (f) => new Date(f.scheduledAt).getTime() >= now,
  )
    .sort(
      (a, b) =>
        new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime(),
    )
    .slice(0, limit);
}
