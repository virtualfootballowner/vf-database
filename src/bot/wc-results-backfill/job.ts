import type { Client } from "discord.js";

import { backfillLeagueResultsDiscord } from "@/lib/league/backfill-results-discord";
import { createBotSupabase } from "@/bot/stats-queries";

const TICK_MS = 5 * 60 * 1000;

/** Catch WC results Vercel missed (e.g. bad DISCORD_BOT_TOKEN on the website). */
export function scheduleWcResultsBackfillJob(_client: Client): void {
  console.log(
    `[wc-results-backfill] scheduled every ${TICK_MS / 60_000}m · checks for unposted S3-WC fixtures`,
  );

  const run = () => {
    void backfillLeagueResultsDiscord(createBotSupabase()).catch((err) => {
      console.error("[wc-results-backfill] tick:", err);
    });
  };

  run();
  setInterval(run, TICK_MS);
}
