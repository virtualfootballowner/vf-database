/**
 * Official Season 3 World Cup calendar — group matchdays + knockout window.
 */

import type { S3WorldCupGroupLetter } from "@/lib/s3-world-cup-groups";

export type S3WorldCupMatchday = 1 | 2 | 3;

type GroupPair = "AB" | "CD" | "EF";

const GROUP_PAIR: Record<S3WorldCupGroupLetter, GroupPair> = {
  A: "AB",
  B: "AB",
  C: "CD",
  D: "CD",
  E: "EF",
  F: "EF",
};

/** Calendar date (YYYY-MM-DD) for each group's matchday. */
export const S3_WORLD_CUP_GROUP_MATCHDAY_DATES: Record<
  GroupPair,
  Record<S3WorldCupMatchday, string>
> = {
  AB: {
    1: "2026-06-05",
    2: "2026-06-10",
    3: "2026-06-15",
  },
  CD: {
    1: "2026-06-06",
    2: "2026-06-11",
    3: "2026-06-16",
  },
  EF: {
    1: "2026-06-07",
    2: "2026-06-12",
    3: "2026-06-17",
  },
};

export function wcDateForGroupMatchday(
  group: S3WorldCupGroupLetter,
  matchday: S3WorldCupMatchday,
): string {
  return S3_WORLD_CUP_GROUP_MATCHDAY_DATES[GROUP_PAIR[group]][matchday];
}

export function wcGroupPairLabel(group: S3WorldCupGroupLetter): string {
  const pair = GROUP_PAIR[group];
  return pair === "AB" ? "A/B" : pair === "CD" ? "C/D" : "E/F";
}

export const S3_WORLD_CUP_GROUP_MATCHDAY_LABELS: Record<S3WorldCupMatchday, string> = {
  1: "Matchday 1",
  2: "Matchday 2",
  3: "Matchday 3",
};

/** Staggered evening slots (MD1 & MD2). */
export const S3_WORLD_CUP_STAGGERED_SLOTS_BST = [
  "18:00",
  "19:30",
  "20:30",
  "21:30",
] as const;

/** MD3 · both remaining group games per nation kick off together. */
export const S3_WORLD_CUP_SIMULTANEOUS_KICKOFF_BST = "20:00";

export const S3_WORLD_CUP_STADIUM_TBD = "TBD";

/** Two evening kickoffs per knockout day (6–10 pm BST). */
export const S3_WORLD_CUP_KO_DAY_SLOTS_BST = ["18:00", "20:00"] as const;

export type WcKnockoutCalendarDay = {
  date: string;
  dayLabel: string;
  fixtureCodes: readonly string[];
};

export const S3_WORLD_CUP_R16_CALENDAR: readonly WcKnockoutCalendarDay[] = [
  { date: "2026-06-20", dayLabel: "R16 Day 1", fixtureCodes: ["S3-WC-R16-01", "S3-WC-R16-02"] },
  { date: "2026-06-21", dayLabel: "R16 Day 2", fixtureCodes: ["S3-WC-R16-03", "S3-WC-R16-04"] },
  { date: "2026-06-22", dayLabel: "R16 Day 3", fixtureCodes: ["S3-WC-R16-05", "S3-WC-R16-06"] },
  { date: "2026-06-23", dayLabel: "R16 Day 4", fixtureCodes: ["S3-WC-R16-07", "S3-WC-R16-08"] },
];

export const S3_WORLD_CUP_QF_CALENDAR: readonly WcKnockoutCalendarDay[] = [
  { date: "2026-06-25", dayLabel: "QF Day 1", fixtureCodes: ["S3-WC-QF-01", "S3-WC-QF-02"] },
  { date: "2026-06-26", dayLabel: "QF Day 2", fixtureCodes: ["S3-WC-QF-03", "S3-WC-QF-04"] },
];

export const S3_WORLD_CUP_SF_CALENDAR: readonly WcKnockoutCalendarDay[] = [
  { date: "2026-06-29", dayLabel: "Semi-final 1", fixtureCodes: ["S3-WC-SF-01"] },
  { date: "2026-06-30", dayLabel: "Semi-final 2", fixtureCodes: ["S3-WC-SF-02"] },
];

export const S3_WORLD_CUP_FINAL_CALENDAR: readonly WcKnockoutCalendarDay[] = [
  { date: "2026-07-02", dayLabel: "Grand Final", fixtureCodes: ["S3-WC-F-01"] },
];

export const S3_WORLD_CUP_KNOCKOUT_CALENDAR = {
  r16: S3_WORLD_CUP_R16_CALENDAR,
  qf: S3_WORLD_CUP_QF_CALENDAR,
  sf: S3_WORLD_CUP_SF_CALENDAR,
  final: S3_WORLD_CUP_FINAL_CALENDAR,
} as const;

/** Group-stage calendar rows for UI (ordered). */
export const S3_WORLD_CUP_GROUP_CALENDAR_DAYS: readonly {
  date: string;
  matchday: S3WorldCupMatchday;
  groupsLabel: string;
  groups: readonly [S3WorldCupGroupLetter, S3WorldCupGroupLetter];
  simultaneous: boolean;
}[] = [
  { date: "2026-06-05", matchday: 1, groupsLabel: "A/B", groups: ["A", "B"], simultaneous: false },
  { date: "2026-06-06", matchday: 1, groupsLabel: "C/D", groups: ["C", "D"], simultaneous: false },
  { date: "2026-06-07", matchday: 1, groupsLabel: "E/F", groups: ["E", "F"], simultaneous: false },
  { date: "2026-06-10", matchday: 2, groupsLabel: "A/B", groups: ["A", "B"], simultaneous: false },
  { date: "2026-06-11", matchday: 2, groupsLabel: "C/D", groups: ["C", "D"], simultaneous: false },
  { date: "2026-06-12", matchday: 2, groupsLabel: "E/F", groups: ["E", "F"], simultaneous: false },
  { date: "2026-06-15", matchday: 3, groupsLabel: "A/B", groups: ["A", "B"], simultaneous: true },
  { date: "2026-06-16", matchday: 3, groupsLabel: "C/D", groups: ["C", "D"], simultaneous: true },
  { date: "2026-06-17", matchday: 3, groupsLabel: "E/F", groups: ["E", "F"], simultaneous: true },
];
