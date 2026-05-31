/**
 * Season 3 World Cup · group-stage schedule (MD1–MD3).
 * Pairings are seeded-shuffled per group; dates follow the official calendar.
 */

import { teams, type Team } from "@/app/teams/teams-data";
import {
  S3_WORLD_CUP_GROUP_MATCHDAY_LABELS,
  S3_WORLD_CUP_SIMULTANEOUS_KICKOFF_BST,
  S3_WORLD_CUP_STADIUM_TBD,
  S3_WORLD_CUP_STAGGERED_SLOTS_BST,
  wcDateForGroupMatchday,
  type S3WorldCupMatchday,
} from "@/lib/s3-world-cup-calendar";
import {
  S3_WORLD_CUP_GROUPS,
  S3_WORLD_CUP_GROUP_LETTERS,
  type S3WorldCupGroupLetter,
} from "@/lib/s3-world-cup-groups";
import { bstKickoffIso } from "@/lib/wc-fixture-kickoff";

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
  matchday: S3WorldCupMatchday;
  matchdayLabel: string;
  /** @deprecated use matchday */
  gameWeek: S3WorldCupMatchday;
  /** @deprecated use matchdayLabel */
  gameWeekLabel: string;
  homeSlug: string;
  awaySlug: string;
  homeTeamName: string;
  awayTeamName: string;
  calendarDate: string;
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

function buildRawGroupFixtures(): Omit<
  S3WorldCupGroupFixture,
  "scheduledAt" | "stadium" | "calendarDate"
>[] {
  const raw: Omit<
    S3WorldCupGroupFixture,
    "scheduledAt" | "stadium" | "calendarDate"
  >[] = [];

  for (const group of S3_WORLD_CUP_GROUP_LETTERS) {
    const pool = S3_WORLD_CUP_GROUPS[group];
    const shuffled = seededShuffle(pool, `vf-s3-wc-2026-group-${group}`);

    FOUR_TEAM_ROUND_ROBIN.forEach(([hi, ai], idx) => {
      const matchInGroup = idx + 1;
      const matchday = (matchInGroup <= 2 ? 1 : matchInGroup <= 4 ? 2 : 3) as
        | 1
        | 2
        | 3;
      const homeSlug = shuffled[hi]!;
      const awaySlug = shuffled[ai]!;
      const matchdayLabel = S3_WORLD_CUP_GROUP_MATCHDAY_LABELS[matchday];

      raw.push({
        fixtureCode: `S3-WC-G-${group}-${String(matchInGroup).padStart(2, "0")}`,
        group,
        matchInGroup,
        matchday,
        matchdayLabel,
        gameWeek: matchday,
        gameWeekLabel: matchdayLabel,
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
  raw: Omit<S3WorldCupGroupFixture, "scheduledAt" | "stadium" | "calendarDate">[],
): S3WorldCupGroupFixture[] {
  const withDates = raw.map((row) => ({
    ...row,
    calendarDate: wcDateForGroupMatchday(row.group, row.matchday),
  }));

  const byDate = new Map<string, typeof withDates>();
  for (const row of withDates) {
    const list = byDate.get(row.calendarDate) ?? [];
    list.push(row);
    byDate.set(row.calendarDate, list);
  }

  const scheduled: S3WorldCupGroupFixture[] = [];

  for (const [date, dayFixtures] of byDate) {
    const matchday = dayFixtures[0]!.matchday;
    const sorted = [...dayFixtures].sort((a, b) => {
      if (a.group !== b.group) return a.group.localeCompare(b.group);
      return a.matchInGroup - b.matchInGroup;
    });

    if (matchday === 3) {
      for (const row of sorted) {
        scheduled.push({
          ...row,
          scheduledAt: bstKickoffIso(date, S3_WORLD_CUP_SIMULTANEOUS_KICKOFF_BST),
          stadium: S3_WORLD_CUP_STADIUM_TBD,
        });
      }
    } else {
      sorted.forEach((row, idx) => {
        const slot =
          S3_WORLD_CUP_STAGGERED_SLOTS_BST[idx] ??
          S3_WORLD_CUP_STAGGERED_SLOTS_BST[S3_WORLD_CUP_STAGGERED_SLOTS_BST.length - 1]!;
        scheduled.push({
          ...row,
          scheduledAt: bstKickoffIso(date, slot),
          stadium: S3_WORLD_CUP_STADIUM_TBD,
        });
      });
    }
  }

  return scheduled.sort(
    (a, b) =>
      a.scheduledAt.localeCompare(b.scheduledAt) ||
      a.group.localeCompare(b.group) ||
      a.matchInGroup - b.matchInGroup,
  );
}

export const S3_WORLD_CUP_GROUP_FIXTURES: S3WorldCupGroupFixture[] =
  assignKickoffs(buildRawGroupFixtures());

export function s3WorldCupFixturesForMatchday(
  md: S3WorldCupMatchday,
): S3WorldCupGroupFixture[] {
  return S3_WORLD_CUP_GROUP_FIXTURES.filter((f) => f.matchday === md);
}

/** @deprecated use s3WorldCupFixturesForMatchday */
export function s3WorldCupFixturesForGameWeek(
  gw: S3WorldCupMatchday,
): S3WorldCupGroupFixture[] {
  return s3WorldCupFixturesForMatchday(gw);
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
