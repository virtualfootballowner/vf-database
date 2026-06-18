import type { SupabaseClient } from "@supabase/supabase-js";

import { postLeagueResultsDiscord } from "@/lib/league/post-results-discord";
import {
  refreshTeamSeasonRecordsForMatchBestEffort,
  refreshTeamSeasonRecordsForSeason,
} from "@/lib/league/team-season-records";

export type LeagueFinalizeOutcome =
  | {
      ok: true;
      matchId: string;
      robloxMatchId: string;
      homeScore: number;
      awayScore: number;
      discordPosted: boolean;
      discordMessageId?: string;
      discordSkipped?: boolean;
    }
  | { ok: false; matchId: string; robloxMatchId: string; reason: string };

type MatchRow = {
  id: string;
  roblox_match_id: string | null;
  status: string;
  home_team_id: string;
  away_team_id: string;
  home_score: number | null;
  away_score: number | null;
};

type GoalEventRow = {
  event_type: string;
  team_id: string | null;
};

/**
 * Finalize a league fixture after Roblox sends `match_end` / `fulltime`.
 * Tallies goals from `match_events`, writes scores, refreshes standings, posts #results.
 */
export async function autoFinalizeLeagueMatch(
  supabase: SupabaseClient,
  matchId: string,
): Promise<LeagueFinalizeOutcome> {
  const { data: matchRow, error: mErr } = await supabase
    .from("matches")
    .select(
      "id, roblox_match_id, status, home_team_id, away_team_id, home_score, away_score",
    )
    .eq("id", matchId)
    .maybeSingle();
  if (mErr) throw mErr;

  const match = matchRow as MatchRow | null;
  const robloxMatchId = match?.roblox_match_id?.trim() || "";
  if (!match || !robloxMatchId) {
    return {
      ok: false,
      matchId,
      robloxMatchId: robloxMatchId || "—",
      reason: "Match not found.",
    };
  }

  if (match.status === "completed") {
    await refreshTeamSeasonRecordsForMatchBestEffort(
      supabase,
      match.id,
      "[league-finalize]",
    );
    const discord = await postLeagueResultsDiscord(supabase, robloxMatchId);
    const discordPosted =
      discord.ok && !("skipped" in discord && discord.skipped);
    if (!discordPosted) {
      const reason =
        discord.ok && "skipped" in discord
          ? discord.reason
          : !discord.ok
            ? discord.reason
            : "unknown";
      console.error(
        `[league-finalize] Discord results not posted for ${robloxMatchId}: ${reason}`,
      );
    }
    return {
      ok: true,
      matchId: match.id,
      robloxMatchId,
      homeScore: match.home_score ?? 0,
      awayScore: match.away_score ?? 0,
      discordPosted,
      discordMessageId:
        discord.ok && "messageId" in discord ? discord.messageId : undefined,
      discordSkipped:
        discord.ok && "skipped" in discord ? discord.skipped : undefined,
    };
  }

  if (match.status === "cancelled") {
    return {
      ok: false,
      matchId: match.id,
      robloxMatchId,
      reason: "Match is cancelled.",
    };
  }

  const { data: evRows, error: evErr } = await supabase
    .from("match_events")
    .select("event_type, team_id")
    .eq("match_id", match.id);
  if (evErr) throw evErr;

  let homeScore = 0;
  let awayScore = 0;
  for (const ev of (evRows ?? []) as GoalEventRow[]) {
    const type = String(ev.event_type).trim().toLowerCase();
    if (type !== "goal" && type !== "own_goal") continue;
    const teamId = ev.team_id;
    if (!teamId) continue;
    if (type === "goal") {
      if (teamId === match.home_team_id) homeScore += 1;
      else if (teamId === match.away_team_id) awayScore += 1;
    } else if (type === "own_goal") {
      if (teamId === match.home_team_id) awayScore += 1;
      else if (teamId === match.away_team_id) homeScore += 1;
    }
  }

  const now = new Date().toISOString();
  const { error: upErr } = await supabase
    .from("matches")
    .update({
      home_score: homeScore,
      away_score: awayScore,
      status: "completed",
      ended_at: now,
    })
    .eq("id", match.id);
  if (upErr) throw upErr;

  try {
    await supabase.rpc("refresh_player_goal_assist_totals");
  } catch {
    /* RPC may be blocked via PostgREST; stats refresh is best-effort here. */
  }
  await refreshTeamSeasonRecordsForSeason(
    supabase,
    await matchSeason(supabase, match.id),
  );

  const discord = await postLeagueResultsDiscord(supabase, robloxMatchId);
  const discordPosted =
    discord.ok && !("skipped" in discord && discord.skipped);
  if (!discordPosted) {
    const reason =
      discord.ok && "skipped" in discord
        ? discord.reason
        : !discord.ok
          ? discord.reason
          : "unknown";
    console.error(
      `[league-finalize] Discord results not posted for ${robloxMatchId}: ${reason}`,
    );
  }

  return {
    ok: true,
    matchId: match.id,
    robloxMatchId,
    homeScore,
    awayScore,
    discordPosted,
    discordMessageId:
      discord.ok && "messageId" in discord ? discord.messageId : undefined,
    discordSkipped:
      discord.ok && "skipped" in discord ? discord.skipped : undefined,
  };
}

async function matchSeason(
  supabase: SupabaseClient,
  matchId: string,
): Promise<number> {
  const { data } = await supabase
    .from("matches")
    .select("season")
    .eq("id", matchId)
    .maybeSingle();
  return typeof data?.season === "number" ? data.season : 1;
}
