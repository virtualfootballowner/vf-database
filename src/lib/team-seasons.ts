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
