import type { SupabaseClient } from "@supabase/supabase-js";

import { createBotSupabase } from "@/bot/stats-queries";

export type MediaAssignmentRow = {
  id: string;
  guild_id: string;
  channel_id: string | null;
  message_id: string | null;
  season: number;
  competition: string;
  game_week_label: string | null;
  home_team_name: string;
  away_team_name: string;
  kickoff_label: string | null;
  posted_by_discord_id: string;
  posted_by_discord_tag: string | null;
  status: "open" | "claimed" | "cancelled" | "completed";
  streamer_claimed_by_discord_id: string | null;
  streamer_claimed_at: string | null;
  streamer_display_name: string | null;
  commentator_claimed_by_discord_id: string | null;
  commentator_claimed_at: string | null;
  commentator_display_name: string | null;
  match_id: string | null;
  created_at: string;
  updated_at: string;
};

export function mediaAssignmentBothSlotsFilled(
  row: MediaAssignmentRow,
): boolean {
  return Boolean(
    row.streamer_claimed_by_discord_id?.trim() &&
      row.commentator_claimed_by_discord_id?.trim(),
  );
}

export function mediaAssignmentStatusFromSlots(
  row: MediaAssignmentRow,
): MediaAssignmentRow["status"] {
  if (row.status === "cancelled" || row.status === "completed") {
    return row.status;
  }
  return mediaAssignmentBothSlotsFilled(row) ? "claimed" : "open";
}

export async function cancelPreviousMediaAssignmentsForMatches(
  supabase: SupabaseClient,
  guildId: string,
  matchIds: string[],
): Promise<number> {
  if (matchIds.length === 0) return 0;
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("media_assignments")
    .update({ status: "cancelled", updated_at: now })
    .eq("guild_id", guildId)
    .in("match_id", matchIds)
    .in("status", ["open", "claimed"])
    .select("id");
  if (error) throw error;
  return data?.length ?? 0;
}

export async function loadMediaAssignment(
  assignmentId: string,
): Promise<MediaAssignmentRow | null> {
  const supabase = createBotSupabase();
  const { data, error } = await supabase
    .from("media_assignments")
    .select("*")
    .eq("id", assignmentId)
    .maybeSingle();
  if (error || !data) return null;
  return data as MediaAssignmentRow;
}
