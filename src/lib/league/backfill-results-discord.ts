import type { SupabaseClient } from "@supabase/supabase-js";

import { postLeagueResultsDiscord } from "@/lib/league/post-results-discord";

const DEFAULT_RESULTS_CHANNEL_ID = "1512487546339459242";

function resultsChannelId(): string {
  return (
    process.env.DISCORD_RESULTS_CHANNEL_ID?.trim() || DEFAULT_RESULTS_CHANNEL_ID
  );
}

/**
 * Post #results embeds for completed fixtures that have not been announced yet.
 * Safe to run on every bot startup — idempotent via match_results_channel_alerts.
 */
export async function backfillLeagueResultsDiscord(
  supabase: SupabaseClient,
): Promise<void> {
  const channelId = resultsChannelId();

  const { data: completed, error: matchErr } = await supabase
    .from("matches")
    .select("id, roblox_match_id")
    .eq("status", "completed")
    .not("roblox_match_id", "is", null);

  if (matchErr) {
    console.error("[results-backfill] match query failed:", matchErr);
    return;
  }

  const rows = (completed ?? []).filter((m) => m.roblox_match_id?.trim());
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
        "[results-backfill] match_results_channel_alerts missing — skipping backfill.",
      );
      return;
    }
    console.error("[results-backfill] alerts query failed:", alertErr);
    return;
  }

  const posted = new Set((alerts ?? []).map((a) => a.match_id));
  const pending = rows.filter((m) => !posted.has(m.id));
  if (pending.length === 0) return;

  console.log(
    `[results-backfill] Posting ${pending.length} completed fixture(s) to #results…`,
  );

  for (const match of pending) {
    const code = match.roblox_match_id!.trim();
    try {
      const out = await postLeagueResultsDiscord(supabase, code, {
        submittedByTag: "VF auto-log",
        channelId,
      });
      if (out.ok && !("skipped" in out && out.skipped)) {
        console.log(`[results-backfill] Posted ${code} → message ${out.messageId}`);
      } else if (out.ok && "skipped" in out && out.skipped) {
        console.log(`[results-backfill] Skipped ${code}: ${out.reason}`);
      } else {
        console.error(`[results-backfill] Failed ${code}: ${out.reason}`);
      }
    } catch (err) {
      console.error(`[results-backfill] Error for ${code}:`, err);
    }
  }
}
