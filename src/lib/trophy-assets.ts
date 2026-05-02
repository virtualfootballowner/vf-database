/**
 * Static competition marks for VF honors (public/ assets).
 */
export const TROPHY_IMAGE = {
  euroleague: "/euroleague_2.png",
  eurobloxCup: "/euroblox.png",
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
export function trophyImageForTrophyTitle(title: string): string | null {
  const t = title.trim();
  if (/euro\s*blox|euroblox/i.test(t)) return TROPHY_IMAGE.eurobloxCup;
  if (/euro\s*league|euroleague/i.test(t)) return TROPHY_IMAGE.euroleague;
  return null;
}
