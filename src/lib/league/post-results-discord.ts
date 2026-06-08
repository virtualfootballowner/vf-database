import type { SupabaseClient } from "@supabase/supabase-js";

import { fetchMatchByRobloxId } from "@/lib/league/match-results-data";
import { loadAppliedFromMatchEvents } from "@/lib/league/applied-from-events";
import { renderLeagueResultsEmbed } from "@/lib/league/results-embed";
import {
  isWorldCupFixtureId,
  worldCupResultsChannelId,
} from "@/lib/league/world-cup-results";
import { discordPostMessage } from "@/lib/discord-rest";

function siteBaseUrl(): string {
  return (
    process.env.VFL_SITE_URL?.trim().replace(/\/$/, "") ||
    "https://myvirtualfootball.com"
  );
}

export type PostLeagueResultsOutcome =
  | { ok: true; messageId: string; channelId: string; skipped?: false }
  | { ok: true; skipped: true; reason: string }
  | { ok: false; reason: string };

function isMissingAlertsTable(error: { code?: string; message?: string }): boolean {
  return (
    error.code === "PGRST205" ||
    (error.message?.includes("match_results_channel_alerts") ?? false)
  );
}

async function claimResultsAlertSlot(
  supabase: SupabaseClient,
  matchId: string,
  channelId: string,
): Promise<boolean | "no_table"> {
  const { error } = await supabase.from("match_results_channel_alerts").insert({
    match_id: matchId,
    channel_id: channelId,
  });
  if (error) {
    if (isMissingAlertsTable(error)) return "no_table";
    if ((error as { code?: string }).code === "23505") return false;
    throw error;
  }
  return true;
}

async function storeResultsMessageId(
  supabase: SupabaseClient,
  matchId: string,
  channelId: string,
  messageId: string,
): Promise<void> {
  await supabase
    .from("match_results_channel_alerts")
    .update({ discord_message_id: messageId })
    .eq("match_id", matchId)
    .eq("channel_id", channelId);
}

/**
 * Post the World Cup results embed to #wc-results for a completed S3-WC fixture.
 * Non-WC fixtures are skipped. Idempotent per match + channel unless `force` is set.
 */
export async function postLeagueResultsDiscord(
  supabase: SupabaseClient,
  robloxMatchId: string,
  options?: {
    force?: boolean;
    submittedByTag?: string;
    channelId?: string;
  },
): Promise<PostLeagueResultsOutcome> {
  const code = robloxMatchId.trim();
  if (!code) return { ok: false, reason: "Missing roblox_match_id." };
  if (!isWorldCupFixtureId(code)) {
    return {
      ok: true,
      skipped: true,
      reason: "Only S3 World Cup fixtures (S3-WC-*) are posted to #wc-results.",
    };
  }

  const match = await fetchMatchByRobloxId(supabase, code);
  if (!match) return { ok: false, reason: `No match found for ${code}.` };
  if (match.status !== "completed") {
    return {
      ok: false,
      reason: `Match ${code} is ${match.status}; only completed fixtures are posted.`,
    };
  }

  const channelId = options?.channelId?.trim() || worldCupResultsChannelId();
  let trackPost = true;
  if (!options?.force) {
    const claimed = await claimResultsAlertSlot(supabase, match.id, channelId);
    if (claimed === "no_table") {
      trackPost = false;
    } else if (!claimed) {
      return {
        ok: true,
        skipped: true,
        reason: "Results embed already posted for this match.",
      };
    }
  } else if (trackPost) {
    const { error: delErr } = await supabase
      .from("match_results_channel_alerts")
      .delete()
      .eq("match_id", match.id)
      .eq("channel_id", channelId);
    if (delErr && !isMissingAlertsTable(delErr)) throw delErr;
    if (delErr && isMissingAlertsTable(delErr)) trackPost = false;
    if (trackPost) {
      const claimed = await claimResultsAlertSlot(supabase, match.id, channelId);
      if (claimed === "no_table") trackPost = false;
    }
  }

  const homeScore = match.home_score ?? 0;
  const awayScore = match.away_score ?? 0;
  const applied = await loadAppliedFromMatchEvents(supabase, match);
  const siteBase = siteBaseUrl();

  const embed = renderLeagueResultsEmbed({
    match,
    homeScore,
    awayScore,
    applied,
    submittedByTag: options?.submittedByTag ?? "Roblox auto-log",
    siteBaseUrl: siteBase,
  });

  const posted = await discordPostMessage(channelId, {
    embeds: [embed],
  });

  if (!posted.ok || !posted.messageId) {
    if (trackPost) {
      await supabase
        .from("match_results_channel_alerts")
        .delete()
        .eq("match_id", match.id)
        .eq("channel_id", channelId);
    }
    return {
      ok: false,
      reason: posted.error ?? `Discord POST failed (${posted.status}).`,
    };
  }

  if (trackPost) {
    await storeResultsMessageId(
      supabase,
      match.id,
      channelId,
      posted.messageId,
    );
  }

  return { ok: true, messageId: posted.messageId, channelId };
}
