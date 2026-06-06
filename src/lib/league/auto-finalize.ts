import type { SupabaseClient } from "@supabase/supabase-js";

import { postLeagueResultsDiscord } from "@/lib/league/post-results-discord";

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
  await refreshTeamSeasonRecordsForSeason(supabase, await matchSeason(supabase, match.id));

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

async function refreshTeamSeasonRecordsForSeason(
  supabase: SupabaseClient,
  season: number,
): Promise<void> {
  const { data: teams, error: tErr } = await supabase
    .from("teams")
    .select("id, slug");
  if (tErr) throw tErr;

  const slugById = new Map<string, string>();
  for (const t of teams ?? []) {
    const s = (t as { slug?: string | null }).slug?.trim();
    if ((t as { id?: string }).id && s) {
      slugById.set((t as { id: string }).id, s);
    }
  }

  const { data: rows, error: mErr } = await supabase
    .from("matches")
    .select("home_team_id, away_team_id, home_score, away_score, status")
    .eq("season", season)
    .eq("status", "completed");
  if (mErr) throw mErr;

  type Tallies = { wins: number; losses: number; draws: number; played: number };
  const bySlug = new Map<string, Tallies>();

  function bump(slug: string, outcome: "w" | "l" | "d") {
    let t = bySlug.get(slug);
    if (!t) {
      t = { wins: 0, losses: 0, draws: 0, played: 0 };
      bySlug.set(slug, t);
    }
    t.played += 1;
    if (outcome === "w") t.wins += 1;
    else if (outcome === "l") t.losses += 1;
    else t.draws += 1;
  }

  for (const m of rows ?? []) {
    const homeSlug = slugById.get(m.home_team_id as string);
    const awaySlug = slugById.get(m.away_team_id as string);
    if (!homeSlug || !awaySlug) continue;

    const hs = (m.home_score as number | null) ?? 0;
    const as_ = (m.away_score as number | null) ?? 0;
    if (hs > as_) {
      bump(homeSlug, "w");
      bump(awaySlug, "l");
    } else if (as_ > hs) {
      bump(awaySlug, "w");
      bump(homeSlug, "l");
    } else {
      bump(homeSlug, "d");
      bump(awaySlug, "d");
    }
  }

  const upserts = [...bySlug.entries()].map(([team_slug, t]) => ({
    team_slug,
    season,
    wins: t.wins,
    losses: t.losses,
    draws: t.draws,
    matches_played: t.played,
  }));

  if (upserts.length === 0) return;

  await supabase
    .from("team_season_records")
    .upsert(upserts, { onConflict: "team_slug,season" });
}
