import type { SupabaseClient } from "@supabase/supabase-js";

import { refereeGuildId } from "@/bot/referees/config";
import type { RefereeAssignmentRow } from "@/bot/referees/queries";
import type { RefereeAssignmentSlot } from "@/lib/referees/discord-constants";

export type PostponementResponseRow = {
  id: string;
  assignment_id: string;
  match_id: string;
  discord_id: string;
  slot: RefereeAssignmentSlot;
  new_scheduled_at: string;
  status: "pending" | "confirmed" | "declined";
  dm_message_id: string | null;
};

export type MatchForRefereeRepost = {
  id: string;
  roblox_match_id: string | null;
  season: number | null;
  competition: string | null;
  game_week_label: string | null;
  scheduled_at: string;
  home_name: string;
  away_name: string;
  home_slug: string | null;
  away_slug: string | null;
};

export function claimedSlotsForAssignment(
  row: RefereeAssignmentRow,
): { slot: RefereeAssignmentSlot; discordId: string }[] {
  const out: { slot: RefereeAssignmentSlot; discordId: string }[] = [];
  const main =
    row.main_claimed_by_discord_id?.trim() || row.claimed_by_discord_id?.trim();
  if (main) out.push({ slot: "main", discordId: main });
  const lines = row.linesman_claimed_by_discord_id?.trim();
  if (lines) out.push({ slot: "linesman", discordId: lines });
  return out;
}

export async function fetchLatestAssignmentForMatch(
  supabase: SupabaseClient,
  matchId: string,
): Promise<RefereeAssignmentRow | null> {
  const { data, error } = await supabase
    .from("referee_assignments")
    .select("*")
    .eq("guild_id", refereeGuildId())
    .eq("match_id", matchId)
    .in("status", ["open", "claimed"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return (data as RefereeAssignmentRow | null) ?? null;
}

export async function fetchMatchForRefereeRepost(
  supabase: SupabaseClient,
  matchId: string,
): Promise<MatchForRefereeRepost | null> {
  const { data: match, error } = await supabase
    .from("matches")
    .select(
      "id, roblox_match_id, season, competition, game_week_label, scheduled_at, home_team_id, away_team_id",
    )
    .eq("id", matchId)
    .maybeSingle();
  if (error) throw error;
  if (!match) return null;

  const row = match as {
    id: string;
    roblox_match_id: string | null;
    season: number | null;
    competition: string | null;
    game_week_label: string | null;
    scheduled_at: string;
    home_team_id: string;
    away_team_id: string;
  };

  const { data: teams, error: teamErr } = await supabase
    .from("teams")
    .select("id, name, slug")
    .in("id", [row.home_team_id, row.away_team_id]);
  if (teamErr) throw teamErr;

  const byId = new Map(
    (teams ?? []).map((t) => [
      t.id as string,
      t as { id: string; name: string; slug: string | null },
    ]),
  );
  const home = byId.get(row.home_team_id);
  const away = byId.get(row.away_team_id);
  if (!home || !away) return null;

  return {
    id: row.id,
    roblox_match_id: row.roblox_match_id,
    season: row.season,
    competition: row.competition,
    game_week_label: row.game_week_label,
    scheduled_at: row.scheduled_at,
    home_name: home.name,
    away_name: away.name,
    home_slug: home.slug,
    away_slug: away.slug,
  };
}

export async function insertPostponementResponse(
  supabase: SupabaseClient,
  input: {
    id: string;
    assignmentId: string;
    matchId: string;
    discordId: string;
    slot: RefereeAssignmentSlot;
    newScheduledAt: string;
  },
): Promise<PostponementResponseRow | null> {
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("referee_postponement_responses")
    .insert({
      id: input.id,
      assignment_id: input.assignmentId,
      match_id: input.matchId,
      discord_id: input.discordId,
      slot: input.slot,
      new_scheduled_at: input.newScheduledAt,
      status: "pending",
      created_at: now,
      updated_at: now,
    })
    .select("*")
    .maybeSingle();
  if (error) {
    if (error.code === "23505") return null;
    throw error;
  }
  return data as PostponementResponseRow;
}

export async function fetchPostponementResponse(
  supabase: SupabaseClient,
  responseId: string,
): Promise<PostponementResponseRow | null> {
  const { data, error } = await supabase
    .from("referee_postponement_responses")
    .select("*")
    .eq("id", responseId)
    .maybeSingle();
  if (error) throw error;
  return (data as PostponementResponseRow | null) ?? null;
}

export async function fetchPostponementResponsesForBatch(
  supabase: SupabaseClient,
  assignmentId: string,
  newScheduledAt: string,
): Promise<PostponementResponseRow[]> {
  const { data, error } = await supabase
    .from("referee_postponement_responses")
    .select("*")
    .eq("assignment_id", assignmentId)
    .eq("new_scheduled_at", newScheduledAt);
  if (error) throw error;
  return (data ?? []) as PostponementResponseRow[];
}

export async function setPostponementResponseStatus(
  supabase: SupabaseClient,
  responseId: string,
  status: "confirmed" | "declined",
): Promise<PostponementResponseRow | null> {
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("referee_postponement_responses")
    .update({ status, updated_at: now })
    .eq("id", responseId)
    .eq("status", "pending")
    .select("*")
    .maybeSingle();
  if (error) throw error;
  return (data as PostponementResponseRow | null) ?? null;
}

export async function cancelAssignment(
  supabase: SupabaseClient,
  assignmentId: string,
): Promise<void> {
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("referee_assignments")
    .update({ status: "cancelled", updated_at: now })
    .eq("id", assignmentId);
  if (error) throw error;
}
