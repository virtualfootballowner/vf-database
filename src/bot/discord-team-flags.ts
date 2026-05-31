/**
 * Discord built-in flag shortcodes for Season 3 nations.
 * @see https://discord.com/developers/docs/resources/emoji — `:flag_xx:` uses ISO 3166-1 alpha-2.
 * England uses Discord's `:england:` subregion emoji (not `:flag_gb:`).
 */
const DISCORD_FLAG_BY_SLUG: Record<string, string> = {
  albania: ":flag_al:",
  argentina: ":flag_ar:",
  belgium: ":flag_be:",
  brazil: ":flag_br:",
  canada: ":flag_ca:",
  england: ":england:",
  france: ":flag_fr:",
  germany: ":flag_de:",
  greece: ":flag_gr:",
  italy: ":flag_it:",
  japan: ":flag_jp:",
  mexico: ":flag_mx:",
  morocco: ":flag_ma:",
  netherlands: ":flag_nl:",
  nigeria: ":flag_ng:",
  "north-korea": ":flag_kp:",
  norway: ":flag_no:",
  portugal: ":flag_pt:",
  russia: ":flag_ru:",
  somalia: ":flag_so:",
  spain: ":flag_es:",
  switzerland: ":flag_ch:",
  ukraine: ":flag_ua:",
  usa: ":flag_us:",
};

/** Fixture / match sheet short names → slug (for legacy unlinked fixture rows). */
const SLUG_BY_FIXTURE_NAME: Record<string, string> = {
  albania: "albania",
  argentina: "argentina",
  belgium: "belgium",
  brazil: "brazil",
  canada: "canada",
  croatia: "canada",
  england: "england",
  france: "france",
  germany: "germany",
  greece: "greece",
  italy: "italy",
  japan: "japan",
  mexico: "mexico",
  morocco: "morocco",
  netherlands: "netherlands",
  nigeria: "nigeria",
  "north korea": "north-korea",
  norway: "norway",
  portugal: "portugal",
  russia: "russia",
  somalia: "somalia",
  spain: "spain",
  switzerland: "switzerland",
  ukraine: "ukraine",
  usa: "usa",
};

export function discordTeamFlag(slug: string | null | undefined): string {
  if (!slug) return "";
  return DISCORD_FLAG_BY_SLUG[slug.trim().toLowerCase()] ?? "";
}

export function discordTeamFlagForName(name: string): string {
  const key = name.trim().toLowerCase();
  const slug = SLUG_BY_FIXTURE_NAME[key];
  return slug ? discordTeamFlag(slug) : "";
}

/** Team name with a leading Discord flag shortcode when the side is a known nation. */
export function discordTeamLabel(
  name: string,
  slug?: string | null,
): string {
  const flag = discordTeamFlag(slug) || discordTeamFlagForName(name);
  return flag ? `${flag} **${name}**` : `**${name}**`;
}
