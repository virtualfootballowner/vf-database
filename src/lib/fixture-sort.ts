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

/** Newest kickoff first; undated fixtures stay at the bottom. */
export function compareFixtureRowsReverseChronological(
  a: Pick<FixtureRow, "id" | "match" | "schedule">,
  b: Pick<FixtureRow, "id" | "match" | "schedule">,
): number {
  const aDate = fixtureRowSortDate(a);
  const bDate = fixtureRowSortDate(b);
  const aUndated = aDate === UNDATED_SORT_KEY;
  const bUndated = bDate === UNDATED_SORT_KEY;
  if (aUndated && bUndated) return a.id.localeCompare(b.id);
  if (aUndated) return 1;
  if (bUndated) return -1;
  if (aDate !== bDate) return bDate.localeCompare(aDate);
  const aTime = fixtureRowSortTime(a);
  const bTime = fixtureRowSortTime(b);
  if (aTime !== bTime) return bTime.localeCompare(aTime);
  return a.id.localeCompare(b.id);
}

/** Newest season / competition block first. */
export function compareFixtureGroupsReverseChronological(
  a: FixtureGroupLike,
  b: FixtureGroupLike,
): number {
  return -compareFixtureGroupsChronological(a, b);
}

function fixtureRowKickoffMs(
  row: Pick<FixtureRow, "match" | "schedule">,
): number | null {
  const dateStr = fixtureRowSortDate(row);
  if (dateStr === UNDATED_SORT_KEY) return null;
  const timeStr = fixtureRowSortTime(row);
  const iso = timeStr || `${dateStr}T12:00:00Z`;
  const ms = new Date(iso).getTime();
  return Number.isNaN(ms) ? null : ms;
}

/**
 * Closest kickoff to now first (today's results + next fixtures up top).
 * Undated knockout placeholders sink to the bottom.
 */
export function compareFixtureRowsByProximityToNow(
  a: Pick<FixtureRow, "id" | "match" | "schedule">,
  b: Pick<FixtureRow, "id" | "match" | "schedule">,
): number {
  const aMs = fixtureRowKickoffMs(a);
  const bMs = fixtureRowKickoffMs(b);
  if (aMs == null && bMs == null) return a.id.localeCompare(b.id);
  if (aMs == null) return 1;
  if (bMs == null) return -1;

  const now = Date.now();
  const aDist = Math.abs(aMs - now);
  const bDist = Math.abs(bMs - now);
  if (aDist !== bDist) return aDist - bDist;
  if (aMs !== bMs) return bMs - aMs;
  return a.id.localeCompare(b.id);
}

export function compareScheduledAtChronological(a: string, b: string): number {
  return a.localeCompare(b);
}
