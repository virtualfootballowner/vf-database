/** Coerce DB / JSON season arrays so `.includes(3)` works (handles string "3", etc.). */
export function normalizeSeasons(seasons: unknown): number[] {
  if (!Array.isArray(seasons)) return [];
  const out: number[] = [];
  for (const x of seasons) {
    const n =
      typeof x === "number" && Number.isFinite(x)
        ? Math.trunc(x)
        : Number.parseInt(String(x), 10);
    if (Number.isInteger(n) && n > 0) out.push(n);
  }
  return [...new Set(out)].sort((a, b) => a - b);
}

export function teamHasSeason(seasons: unknown, season: number): boolean {
  return normalizeSeasons(seasons).includes(season);
}

/** Season 3 World Cup pool — national squads only (no league clubs tagged S3). */
export function isSeason3NationOnlyTeam(seasons: unknown): boolean {
  const s = normalizeSeasons(seasons);
  return s.includes(3) && !s.includes(1) && !s.includes(2);
}

/** Teams page season tab — S3 excludes league clubs even if mis-tagged in DB. */
export function teamMatchesSeasonFilter(
  seasons: unknown,
  season: number,
): boolean {
  if (season === 3) return isSeason3NationOnlyTeam(seasons);
  return teamHasSeason(seasons, season);
}
