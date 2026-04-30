/**
 * Recompute players.goals_total and players.assists_total from match_events.
 * Run after editing events, or any time totals drift.
 */
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import path from "node:path";

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

async function main() {
  const { error } = await supabase.rpc("refresh_player_goal_assist_totals");
  if (error) throw error;
  console.log("refresh_player_goal_assist_totals OK.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
