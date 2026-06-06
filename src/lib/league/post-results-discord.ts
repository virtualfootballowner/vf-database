import type { SupabaseClient } from "@supabase/supabase-js";

import { fetchMatchByRobloxId } from "@/bot/results/queries";
import { absoluteSiteAssetUrl, fetchTeamLogoUrl } from "@/bot/site-assets";
import { loadAppliedFromMatchEvents } from "@/lib/league/applied-from-events";
import { renderLeagueResultsEmbed } from "@/lib/league/results-embed";
import { discordPostMessage } from "@/lib/discord-rest";

const DEFAULT_RESULTS_CHANNEL_ID = "1512487546339459242";

function resultsChannelId(): string {
  return (
    process.env.DISCORD_RESULTS_CHANNEL_ID?.trim() || DEFAULT_RESULTS_CHANNEL_ID
  );
}

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
 * Post the standard VF League results embed to #results for a completed fixture.
 * Idempotent per match + channel unless `force` is set.
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

  const match = await fetchMatchByRobloxId(supabase, code);
  if (!match) return { ok: false, reason: `No match found for ${code}.` };
  if (match.status !== "completed") {
    return {
      ok: false,
      reason: `Match ${code} is ${match.status}; only completed fixtures are posted.`,
    };
  }

  const channelId = options?.channelId?.trim() || resultsChannelId();
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

  const [homeLogoUrl, awayLogoUrl] = await Promise.all([
    match.home_slug
      ? fetchTeamLogoUrl(supabase, match.home_slug, siteBase)
      : Promise.resolve(null),
    match.away_slug
      ? fetchTeamLogoUrl(supabase, match.away_slug, siteBase)
      : Promise.resolve(null),
  ]);

  const thumb =
    homeLogoUrl ??
    awayLogoUrl ??
    absoluteSiteAssetUrl("/golden shield.png", siteBase);

  const embed = renderLeagueResultsEmbed({
    match,
    homeScore,
    awayScore,
    applied,
    submittedByTag: options?.submittedByTag ?? "Roblox auto-log",
    siteBaseUrl: siteBase,
    thumbnailUrl: thumb,
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
