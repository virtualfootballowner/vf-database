import { TEAM_SEASON_MANAGER_SEED } from "@/lib/team-season-manager-seed";

/** Prefer DB names; fill gaps from `TEAM_SEASON_MANAGER_SEED` when migrations are missing or names are null. */
export function fillManagerNamesFromSeed(
  slug: string,
  seasons: number[],
  bySeasonFromDb: Map<number, string | null>,
): Map<number, string | null> {
  const out = new Map<number, string | null>();
  const seed = TEAM_SEASON_MANAGER_SEED[slug];
  for (const s of seasons) {
    const fromDb = bySeasonFromDb.get(s);
    const dbOk = fromDb != null && String(fromDb).trim() !== "";
    if (dbOk) {
      out.set(s, String(fromDb).trim());
      continue;
    }
    const fromSeed = seed?.[s as 1 | 2 | 3];
    if (fromSeed != null && String(fromSeed).trim() !== "") {
      out.set(s, String(fromSeed).trim());
    } else {
      out.set(s, null);
    }
  }
  return out;
}
