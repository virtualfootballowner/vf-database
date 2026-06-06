/** Season 3 World Cup — auto Discord results feed (#wc-results). */

export const WORLD_CUP_RESULTS_CHANNEL_ID = "1512673440241291417";

/** Fixture codes like S3-WC-G-B-02, S3-WC-R16-01, S3-WC-F-01 */
export function isWorldCupFixtureId(robloxMatchId: string): boolean {
  return /^S3-WC-/i.test(robloxMatchId.trim());
}

export function worldCupResultsChannelId(): string {
  return (
    process.env.DISCORD_RESULTS_CHANNEL_ID?.trim() ||
    WORLD_CUP_RESULTS_CHANNEL_ID
  );
}
