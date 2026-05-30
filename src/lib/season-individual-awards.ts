import "server-only";

import { cache } from "react";

import { createSupabaseServerClient } from "@/lib/supabase-server";

/** Awards shown on Stats → Tournaments (season block). */
export const TOURNAMENTS_INDIVIDUAL_AWARD_ORDER = [
  "Ballon d'Or",
  "Golden Boot",
  "Golden Glove",
  "Golden Shield",
] as const;

export type TournamentsIndividualAwardTitle =
  (typeof TOURNAMENTS_INDIVIDUAL_AWARD_ORDER)[number];

export type SeasonIndividualAward = {
  season: number;
  title: TournamentsIndividualAwardTitle;
  roblox_username: string;
};

type AccoladeRow = { title?: string; season?: number };

const DB_TITLE_TO_DISPLAY: Record<string, TournamentsIndividualAwardTitle> = {
  "Ballon d'Or": "Ballon d'Or",
  "Golden Boot": "Golden Boot",
  "Golden Glove": "Golden Glove",
  "Golden Shield": "Golden Shield",
};

function normalizeAccolade(
  row: AccoladeRow,
  username: string,
): SeasonIndividualAward | null {
  const title = row.title?.trim();
  const season = row.season;
  if (!title || season == null || !Number.isFinite(season)) return null;

  const displayTitle = DB_TITLE_TO_DISPLAY[title];
  if (!displayTitle) return null;

  return {
    season,
    title: displayTitle,
    roblox_username: username,
  };
}

async function loadSeasonIndividualAwards(): Promise<SeasonIndividualAward[]> {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return [];
  }

  try {
    const supabase = createSupabaseServerClient();
    const { data, error } = await supabase
      .from("players")
      .select("roblox_username, accolades")
      .neq("accolades", "[]");

    if (error || !data) return [];

    const out: SeasonIndividualAward[] = [];
    for (const row of data) {
      const username = row.roblox_username?.trim();
      if (!username) continue;
      const accolades = row.accolades as AccoladeRow[] | null;
      if (!Array.isArray(accolades)) continue;
      for (const entry of accolades) {
        const award = normalizeAccolade(entry, username);
        if (award) out.push(award);
      }
    }
    return out;
  } catch {
    return [];
  }
}

export const getSeasonIndividualAwards = cache(loadSeasonIndividualAwards);

export function individualAwardsForSeason(
  all: SeasonIndividualAward[],
  season: number,
): SeasonIndividualAward[] {
  const byTitle = new Map<TournamentsIndividualAwardTitle, SeasonIndividualAward>();
  for (const award of all) {
    if (award.season !== season) continue;
    byTitle.set(award.title, award);
  }
  return TOURNAMENTS_INDIVIDUAL_AWARD_ORDER.flatMap((title) => {
    const hit = byTitle.get(title);
    return hit ? [hit] : [];
  });
}
