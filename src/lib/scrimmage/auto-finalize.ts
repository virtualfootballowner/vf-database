/**
 * Auto-finalization for FACEIT scrimmages.
 *
 * Triggered from `POST /api/scrimmage/events` when Roblox sends a
 * `match_end` (or `fulltime`) event. Replaces the old captain-driven
 * `/scrimmage report` + confirm/dispute window — the game is now the
 * single source of truth for scores.
 *
 * Steps:
 *   1. Idempotency guard — bail if the match is already terminal.
 *   2. Pull every `scrimmage_match_events` row for the match.
 *   3. Tally goals per team:
 *        - `goal` event by a player on team N → +1 for team N
 *        - `own_goal` event by a player on team N → +1 for the OTHER team
 *      Goal events without a resolved player_id are silently ignored
 *      (we have no way to attribute them to a side).
 *   4. Group goal scorers by player_id for the result-embed footer.
 *   5. Call `applyScrimmageResult` (the existing ELO pipeline used by
 *      the bot during the manual-report era) — this writes scores +
 *      per-player ELO deltas + flips status to `completed`.
 *   6. Edit the original lobby card via Discord REST to a result embed.
 *
 * All Discord interaction is best-effort; failure to edit the card
 * never undoes the database state, which is canonical.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  applyScrimmageResult,
  fetchMatchPlayers,
  fetchPlayerNamesByIds,
} from "@/bot/scrimmage/db";
import { discordEditMessage } from "@/lib/discord-rest";
import {
  renderScrimmageResultEmbed,
  type ResultEmbedScorer,
} from "@/lib/scrimmage/result-embed";

export type AutoFinalizeOutcome =
  | {
      ok: true;
      matchId: string;
      matchCode: string;
      team1Score: number;
      team2Score: number;
      team1Delta: number;
      team2Delta: number;
      players_updated: number;
      discord_card_edited: boolean;
    }
  | { ok: false; matchId: string; reason: string };

export async function autoFinalizeScrimmage(
  supabase: SupabaseClient,
  args: {
    matchId: string;
    matchCode: string;
    /** Free-text note shown in the result embed footer body. */
    note?: string;
  },
): Promise<AutoFinalizeOutcome> {
  const matchRow = await fetchMatchForFinalize(supabase, args.matchId);
  if (!matchRow) {
    return { ok: false, matchId: args.matchId, reason: "Match not found." };
  }
  if (
    matchRow.status === "completed" ||
    matchRow.status === "voided" ||
    matchRow.status === "cancelled"
  ) {
    return {
      ok: false,
      matchId: args.matchId,
      reason: `Match already ${matchRow.status}; auto-finalize skipped.`,
    };
  }

  const players = await fetchMatchPlayers(supabase, args.matchId);
  if (players.length === 0) {
    return {
      ok: false,
      matchId: args.matchId,
      reason: "No players on this scrimmage — nothing to finalize.",
    };
  }
  if (!matchRow.team1_captain_id || !matchRow.team2_captain_id) {
    return {
      ok: false,
      matchId: args.matchId,
      reason: "No captains on file — cannot apply ELO.",
    };
  }

  const teamByPlayer = new Map<string, 1 | 2>();
  for (const p of players) teamByPlayer.set(p.player_id, p.team);

  const events = await fetchGoalEvents(supabase, args.matchId);
  const tally = tallyGoals(events, teamByPlayer);

  const result = await applyScrimmageResult(supabase, {
    matchId: args.matchId,
    team1Score: tally.team1Score,
    team2Score: tally.team2Score,
    reportedBy: null,
    confirmedBy: null,
  });

  // Resolve scorer names for the embed.
  const scorerIds = [
    ...new Set([
      ...tally.team1Scorers.map((s) => s.player_id),
      ...tally.team2Scorers.map((s) => s.player_id),
      ...players.map((p) => p.player_id),
    ]),
  ];
  const namesById = await fetchPlayerNamesByIds(supabase, scorerIds);
  const t1Scorers: ResultEmbedScorer[] = tally.team1Scorers.map((s) => ({
    name: namesById.get(s.player_id) ?? "Unknown",
    goals: s.goals,
  }));
  const t2Scorers: ResultEmbedScorer[] = tally.team2Scorers.map((s) => ({
    name: namesById.get(s.player_id) ?? "Unknown",
    goals: s.goals,
  }));

  const embed = renderScrimmageResultEmbed({
    matchCode: args.matchCode,
    team1Score: tally.team1Score,
    team2Score: tally.team2Score,
    team1Avg: result.team1Avg,
    team2Avg: result.team2Avg,
    team1Delta: result.team1Delta,
    team2Delta: result.team2Delta,
    players,
    namesById,
    team1Scorers: t1Scorers,
    team2Scorers: t2Scorers,
    note:
      args.note ??
      "Auto-finalized from Roblox match_end. ELO has been updated for every player.",
  });

  let cardEdited = false;
  if (matchRow.lobby_channel_id && matchRow.lobby_message_id) {
    const editResult = await discordEditMessage(
      matchRow.lobby_channel_id,
      matchRow.lobby_message_id,
      {
        content: "",
        embeds: [embed],
        components: [],
        allowed_mentions: { parse: [] },
      },
    );
    cardEdited = editResult.ok;
  }

  return {
    ok: true,
    matchId: args.matchId,
    matchCode: args.matchCode,
    team1Score: tally.team1Score,
    team2Score: tally.team2Score,
    team1Delta: result.team1Delta,
    team2Delta: result.team2Delta,
    players_updated: result.perPlayer.length,
    discord_card_edited: cardEdited,
  };
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

type GoalEventRow = {
  player_id: string | null;
  event_type: string;
};

async function fetchGoalEvents(
  supabase: SupabaseClient,
  matchId: string,
): Promise<GoalEventRow[]> {
  const { data, error } = await supabase
    .from("scrimmage_match_events")
    .select("player_id, event_type")
    .eq("match_id", matchId)
    .in("event_type", ["goal", "own_goal"]);
  if (error) throw error;
  return (data ?? []) as GoalEventRow[];
}

type FinalizeMatchRow = {
  id: string;
  status: string;
  team1_captain_id: string | null;
  team2_captain_id: string | null;
  lobby_channel_id: string | null;
  lobby_message_id: string | null;
};

async function fetchMatchForFinalize(
  supabase: SupabaseClient,
  matchId: string,
): Promise<FinalizeMatchRow | null> {
  const { data, error } = await supabase
    .from("scrimmage_matches")
    .select(
      "id, status, team1_captain_id, team2_captain_id, lobby_channel_id, lobby_message_id",
    )
    .eq("id", matchId)
    .maybeSingle();
  if (error) throw error;
  return (data as FinalizeMatchRow | null) ?? null;
}

type GoalTally = {
  team1Score: number;
  team2Score: number;
  team1Scorers: { player_id: string; goals: number }[];
  team2Scorers: { player_id: string; goals: number }[];
};

/**
 * Convert raw event rows into final score + per-team scorer list.
 *
 * - `goal` by team-1 player → +1 to team 1, scorer row on team 1
 * - `goal` by team-2 player → +1 to team 2, scorer row on team 2
 * - `own_goal` by team-1 player → +1 to team 2, NO scorer row (own goals
 *    don't credit a scorer)
 * - `own_goal` by team-2 player → +1 to team 1, NO scorer row
 * - Missing/unresolved player_id → ignored (we can't attribute it).
 */
export function tallyGoals(
  events: GoalEventRow[],
  teamByPlayer: Map<string, 1 | 2>,
): GoalTally {
  let team1 = 0;
  let team2 = 0;
  const t1Map = new Map<string, number>();
  const t2Map = new Map<string, number>();

  for (const ev of events) {
    if (!ev.player_id) continue;
    const team = teamByPlayer.get(ev.player_id);
    if (!team) continue;
    if (ev.event_type === "goal") {
      if (team === 1) {
        team1 += 1;
        t1Map.set(ev.player_id, (t1Map.get(ev.player_id) ?? 0) + 1);
      } else {
        team2 += 1;
        t2Map.set(ev.player_id, (t2Map.get(ev.player_id) ?? 0) + 1);
      }
    } else if (ev.event_type === "own_goal") {
      if (team === 1) team2 += 1;
      else team1 += 1;
    }
  }

  const sortByGoals = (a: { goals: number }, b: { goals: number }) =>
    b.goals - a.goals;
  return {
    team1Score: team1,
    team2Score: team2,
    team1Scorers: [...t1Map.entries()]
      .map(([player_id, goals]) => ({ player_id, goals }))
      .sort(sortByGoals),
    team2Scorers: [...t2Map.entries()]
      .map(([player_id, goals]) => ({ player_id, goals }))
      .sort(sortByGoals),
  };
}
