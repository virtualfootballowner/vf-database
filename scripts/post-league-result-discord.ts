/**
 * Post (or re-post) the #results embed for a completed league fixture.
 *
 *   npx tsx scripts/post-league-result-discord.ts S3-WC-G-B-02
 *   npx tsx scripts/post-league-result-discord.ts S3-WC-G-B-02 --force
 */
import "dotenv/config";

import { createClient } from "@supabase/supabase-js";

import { postLeagueResultsDiscord } from "../src/lib/league/post-results-discord";

async function main() {
  const code = process.argv[2]?.trim();
  const force = process.argv.includes("--force");
  if (!code) {
    console.error("Usage: npx tsx scripts/post-league-result-discord.ts <roblox_match_id> [--force]");
    process.exit(1);
  }

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required.");
    process.exit(1);
  }
  if (!process.env.DISCORD_BOT_TOKEN) {
    console.error("DISCORD_BOT_TOKEN required.");
    process.exit(1);
  }

  const supabase = createClient(url, key);
  const out = await postLeagueResultsDiscord(supabase, code, {
    force,
    submittedByTag: force ? "VF test script" : "Roblox auto-log",
  });

  console.log(JSON.stringify(out, null, 2));
  if (!out.ok) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
