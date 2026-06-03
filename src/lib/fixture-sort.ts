import type { FixtureRow } from "@/app/stats/fixtures-data";

const UNDATED_SORT_KEY = "9999-99-99";

export function fixtureRowSortDate(
  row: Pick<FixtureRow, "match" | "schedule">,
): string {
  return (
    row.match?.date?.trim() ||
    row.schedule?.scheduledAt?.slice(0, 10) ||
    UNDATED_SORT_KEY
  );
}

export function fixtureRowSortTime(
  row: Pick<FixtureRow, "match" | "schedule">,
): string {
  return (
    row.match?.scheduledAt?.trim() ||
    row.schedule?.scheduledAt?.trim() ||
    ""
  );
}

/** Matchday 1 / earliest kickoff first; undated fixtures sink to the bottom. */
export function compareFixtureRowsChronological(
  a: Pick<FixtureRow, "id" | "match" | "schedule">,
  b: Pick<FixtureRow, "id" | "match" | "schedule">,
): number {
  const aDate = fixtureRowSortDate(a);
  const bDate = fixtureRowSortDate(b);
  if (aDate !== bDate) return aDate.localeCompare(bDate);
  const aTime = fixtureRowSortTime(a);
  const bTime = fixtureRowSortTime(b);
  if (aTime !== bTime) return aTime.localeCompare(bTime);
  return a.id.localeCompare(b.id);
}

export type FixtureGroupLike = {
  key: string;
  season: number;
  rows: Pick<FixtureRow, "id" | "match" | "schedule">[];
};

/** Season 1 before 3; competition key in catalog order. */
export function compareFixtureGroupsChronological(
  a: FixtureGroupLike,
  b: FixtureGroupLike,
): number {
  if (a.season !== b.season) return a.season - b.season;
  return a.key.localeCompare(b.key);
}

export function compareScheduledAtChronological(a: string, b: string): number {
  return a.localeCompare(b);
}
