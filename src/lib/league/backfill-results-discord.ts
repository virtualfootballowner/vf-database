import type { SupabaseClient } from "@supabase/supabase-js";

import { postLeagueResultsDiscord } from "@/lib/league/post-results-discord";
import {
  isWorldCupFixtureId,
  worldCupResultsChannelId,
} from "@/lib/league/world-cup-results";

const POST_DELAY_MS = 600;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Post #wc-results embeds for completed World Cup fixtures missing an alert row.
 * WC fixtures only — never league/division history.
 */
export async function backfillLeagueResultsDiscord(
  supabase: SupabaseClient,
): Promise<void> {
  const channelId = worldCupResultsChannelId();

  const { data: completed, error: matchErr } = await supabase
    .from("matches")
    .select("id, roblox_match_id")
    .eq("status", "completed")
    .like("roblox_match_id", "S3-WC-%");

  if (matchErr) {
    console.error("[wc-results-backfill] match query failed:", matchErr);
    return;
  }

  const rows = (completed ?? []).filter(
    (m) => m.roblox_match_id && isWorldCupFixtureId(m.roblox_match_id),
  );
  if (rows.length === 0) return;

  const matchIds = rows.map((m) => m.id);
  const { data: alerts, error: alertErr } = await supabase
    .from("match_results_channel_alerts")
    .select("match_id")
    .eq("channel_id", channelId)
    .in("match_id", matchIds);

  if (alertErr) {
    if (
      alertErr.code === "PGRST205" ||
      alertErr.message?.includes("match_results_channel_alerts")
    ) {
      console.warn(
        "[wc-results-backfill] match_results_channel_alerts missing — skipping.",
      );
      return;
    }
    console.error("[wc-results-backfill] alerts query failed:", alertErr);
    return;
  }

  const posted = new Set((alerts ?? []).map((a) => a.match_id));
  const pending = rows.filter((m) => !posted.has(m.id));
  if (pending.length === 0) return;

  console.log(
    `[wc-results-backfill] Posting ${pending.length} WC fixture(s) to #wc-results…`,
  );

  for (const match of pending) {
    const code = match.roblox_match_id!.trim();
    try {
      const out = await postLeagueResultsDiscord(supabase, code, {
        submittedByTag: "VF auto-log",
        channelId,
      });
      if (out.ok && !("skipped" in out && out.skipped)) {
        console.log(`[wc-results-backfill] Posted ${code} → message ${out.messageId}`);
      } else if (out.ok && "skipped" in out && out.skipped) {
        console.log(`[wc-results-backfill] Skipped ${code}: ${out.reason}`);
      } else if (!out.ok) {
        console.error(`[wc-results-backfill] Failed ${code}: ${out.reason}`);
      }
    } catch (err) {
      console.error(`[wc-results-backfill] Error for ${code}:`, err);
    }
    await sleep(POST_DELAY_MS);
  }
}
