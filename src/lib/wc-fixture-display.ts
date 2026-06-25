import type { FixtureRow } from "@/app/stats/fixtures-data";
import type { MatchRecord } from "@/app/stats/matches-data";
import { slugFor } from "@/app/stats/matches-data";

export type ResolvedWcFixtureDisplay = {
  homeName: string;
  awayName: string;
  homeSlug: string | null;
  awaySlug: string | null;
  kickoffIso: string;
  match: MatchRecord | undefined;
};

/**
 * Single resolver for World Cup fixture cards — prefers live `matches` rows,
 * then `fixtures` table names, then static schedule labels.
 */
export function resolveWcFixtureDisplay(input: {
  fixtureCode: string;
  staticHomeLabel: string;
  staticAwayLabel: string;
  staticHomeSlug?: string;
  staticAwaySlug?: string;
  staticScheduledAt: string;
  fixtureRow?: FixtureRow | null;
  matchesByRobloxId: Map<string, MatchRecord>;
}): ResolvedWcFixtureDisplay {
  const match =
    input.fixtureRow?.match ??
    input.matchesByRobloxId.get(input.fixtureCode);

  const homeName =
    match?.homeTeam?.trim() ||
    input.fixtureRow?.teamA?.trim() ||
    input.staticHomeLabel;
  const awayName =
    match?.awayTeam?.trim() ||
    input.fixtureRow?.teamB?.trim() ||
    input.staticAwayLabel;

  const homeSlug =
    match?.homeSlug?.trim() ||
    slugFor(homeName) ||
    input.staticHomeSlug?.trim() ||
    null;
  const awaySlug =
    match?.awaySlug?.trim() ||
    slugFor(awayName) ||
    input.staticAwaySlug?.trim() ||
    null;

  const kickoffIso =
    match?.scheduledAt?.trim() ||
    input.fixtureRow?.schedule?.scheduledAt?.trim() ||
    input.staticScheduledAt;

  return {
    homeName,
    awayName,
    homeSlug,
    awaySlug,
    kickoffIso,
    match,
  };
}
