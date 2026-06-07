/**
 * Refresh referee/media assignment kickoff_label from live matches.scheduled_at.
 *
 *   npx tsx scripts/sync-assignment-kickoffs.ts
 */
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import path from "node:path";

import { buildAssignmentKickoffLabel } from "../src/bot/referees/assignments";

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

async function syncTable(table: "referee_assignments" | "media_assignments") {
  const { data: rows, error } = await supabase
    .from(table)
    .select("id, match_id, kickoff_label")
    .in("status", ["open", "claimed"]);
  if (error) throw error;

  let updated = 0;
  for (const row of rows ?? []) {
    if (!row.match_id) continue;
    const { data: match, error: mErr } = await supabase
      .from("matches")
      .select("scheduled_at, roblox_match_id")
      .eq("id", row.match_id)
      .maybeSingle();
    if (mErr) throw mErr;
    const scheduledAt = match?.scheduled_at?.trim();
    if (!scheduledAt) continue;

    const label = buildAssignmentKickoffLabel(scheduledAt);
    if (row.kickoff_label === label) continue;

    const { error: uErr } = await supabase
      .from(table)
      .update({ kickoff_label: label, updated_at: new Date().toISOString() })
      .eq("id", row.id);
    if (uErr) throw uErr;

    console.log(`[${table}] ${match?.roblox_match_id ?? row.match_id} → ${label.split("\n")[0]}`);
    updated += 1;
  }
  return updated;
}

async function main(): Promise<void> {
  const ref = await syncTable("referee_assignments");
  const media = await syncTable("media_assignments");
  console.log(`Synced ${ref} referee + ${media} media assignment kickoff label(s).`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
