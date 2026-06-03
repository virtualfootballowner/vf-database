import type { FixtureRow } from "@/app/stats/fixtures-data";

export function fixtureRowSortDate(
  row: Pick<FixtureRow, "match" | "schedule">,
): string {
  return (
    row.match?.date?.trim() ||
    row.schedule?.scheduledAt?.slice(0, 10) ||
    "0000-00-00"
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

/** Most recent kickoff / match date first; undated fixtures sink to the bottom. */
export function compareFixtureRowsNewestFirst(
  a: Pick<FixtureRow, "id" | "match" | "schedule">,
  b: Pick<FixtureRow, "id" | "match" | "schedule">,
): number {
  const aDate = fixtureRowSortDate(a);
  const bDate = fixtureRowSortDate(b);
  if (aDate !== bDate) return bDate.localeCompare(aDate);
  const aTime = fixtureRowSortTime(a);
  const bTime = fixtureRowSortTime(b);
  if (aTime !== bTime) return bTime.localeCompare(aTime);
  return b.id.localeCompare(a.id);
}

export type FixtureGroupLike = {
  key: string;
  season: number;
  rows: Pick<FixtureRow, "id" | "match" | "schedule">[];
};

export function fixtureGroupLatestDate(group: FixtureGroupLike): string {
  let max = "0000-00-00";
  for (const row of group.rows) {
    const d = fixtureRowSortDate(row);
    if (d.localeCompare(max) > 0) max = d;
  }
  return max;
}

/** Groups with the latest fixtures appear first. */
export function compareFixtureGroupsNewestFirst(
  a: FixtureGroupLike,
  b: FixtureGroupLike,
): number {
  const byDate = fixtureGroupLatestDate(b).localeCompare(
    fixtureGroupLatestDate(a),
  );
  if (byDate !== 0) return byDate;
  if (a.season !== b.season) return b.season - a.season;
  return b.key.localeCompare(a.key);
}

export function compareScheduledAtNewestFirst(a: string, b: string): number {
  return b.localeCompare(a);
}
