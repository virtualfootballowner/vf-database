/**
 * Upsert S3 World Cup knockout fixtures + scheduled matches from repo draw data.
 *
 *   npx tsx scripts/apply-r16-fixtures.ts
 */
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import path from "node:path";

import { syncWcKnockoutMatches } from "../src/lib/sync-wc-knockout-matches";

config({ path: path.resolve(process.cwd(), ".env.local"), override: true });

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main(): Promise<void> {
  const result = await syncWcKnockoutMatches(supabase);
  console.log(
    `Synced ${result.fixtureUpserts} knockout fixtures, ${result.matchUpserts} scheduled matches` +
      (result.skippedCompleted > 0
        ? ` (${result.skippedCompleted} completed matches left unchanged)`
        : "") +
      ".",
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
