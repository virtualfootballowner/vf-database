/**
 * Static competition marks for VF honors (public/ assets).
 */
export const TROPHY_IMAGE = {
  euroleague: "/euroleague_2.png",
  eurobloxCup: "/euroblox.png",
  ballonDor: "/balon dor.png",
  goldenBoot: "/Golden boot.png",
  goldenGlove: "/golden glove.png",
  goldenShield: "/golden shield.png",
} as const;

/** DB `team_season_honors.honor_kind` → image under /public */
export function trophyImageForHonorKind(honorKind: string): string | null {
  switch (honorKind) {
    case "euroleague_champion":
      return TROPHY_IMAGE.euroleague;
    case "euroblox_cup_champion":
      return TROPHY_IMAGE.eurobloxCup;
    default:
      return null;
  }
}

/**
 * Player `trophies[].title` or honor label text → image.
 * EuroBlox checked before EuroLeague so "Euroblox Cup" does not match league.
 */
export function accoladeImageForTitle(title: string): string | null {
  const t = title.trim();
  if (!t) return null;
  if (/ball?on\s*d['']?\s*or/i.test(t)) return TROPHY_IMAGE.ballonDor;
  if (/golden\s*boot/i.test(t)) return TROPHY_IMAGE.goldenBoot;
  if (/golden\s*glove/i.test(t)) return TROPHY_IMAGE.goldenGlove;
  if (/golden\s*shield/i.test(t)) return TROPHY_IMAGE.goldenShield;
  return null;
}

export function trophyImageForTrophyTitle(title: string): string | null {
  const t = title.trim();
  if (/euro\s*blox|euroblox/i.test(t)) return TROPHY_IMAGE.eurobloxCup;
  if (/euro\s*league|euroleague/i.test(t)) return TROPHY_IMAGE.euroleague;
  return accoladeImageForTitle(t);
}

/** Trophies and personal accolades → image under /public, if any. */
export function honorImageForTitle(title: string): string | null {
  return trophyImageForTrophyTitle(title) ?? accoladeImageForTitle(title);
}

/**
 * Competition name → competition crest under /public, or null when none.
 * Useful for table/bracket headers in the tournaments archive.
 */
export function competitionLogo(competition: string): string | null {
  const t = competition.trim().toLowerCase();
  if (!t) return null;
  if (t.includes("euroblox")) return TROPHY_IMAGE.eurobloxCup;
  if (t.includes("euroleague")) return TROPHY_IMAGE.euroleague;
  return null;
}
