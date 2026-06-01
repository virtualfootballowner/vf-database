import type { SupabaseClient } from "@supabase/supabase-js";

import { fetchScheduledMatchesWithin } from "@/bot/fixture-reminders/queries";
import { refereeGuildId } from "@/bot/referees/config";

export type UnclaimedAssignmentAlertRow = {
  assignment_id: string;
  guild_id: string;
  channel_id: string | null;
  message_id: string | null;
  season: number;
  competition: string;
  game_week_label: string | null;
  home_team_name: string;
  away_team_name: string;
  match_id: string;
  scheduled_at: string;
  roblox_match_id: string | null;
  home_slug: string;
  away_slug: string;
  missing_main: boolean;
  missing_linesman: boolean;
};

type AssignmentDbRow = {
  id: string;
  guild_id: string;
  channel_id: string | null;
  message_id: string | null;
  season: number;
  competition: string;
  game_week_label: string | null;
  home_team_name: string;
  away_team_name: string;
  main_claimed_by_discord_id: string | null;
  linesman_claimed_by_discord_id: string | null;
  claimed_by_discord_id: string | null;
  match_id: string | null;
  status: string;
};

function slotFilled(id: string | null | undefined): boolean {
  return Boolean(id?.trim());
}

function assignmentFullyClaimed(row: AssignmentDbRow): boolean {
  const main =
    slotFilled(row.main_claimed_by_discord_id) ||
    slotFilled(row.claimed_by_discord_id);
  return main && slotFilled(row.linesman_claimed_by_discord_id);
}

export async function fetchUnclaimedAssignmentsFor24hWindow(
  supabase: SupabaseClient,
  lookaheadMs: number,
): Promise<UnclaimedAssignmentAlertRow[]> {
  const matches = await fetchScheduledMatchesWithin(supabase, lookaheadMs);
  if (matches.length === 0) return [];

  const matchById = new Map(matches.map((m) => [m.id, m]));
  const matchIds = [...matchById.keys()];
  const guildId = refereeGuildId();

  const { data, error } = await supabase
    .from("referee_assignments")
    .select(
      "id, guild_id, channel_id, message_id, season, competition, game_week_label, home_team_name, away_team_name, main_claimed_by_discord_id, linesman_claimed_by_discord_id, claimed_by_discord_id, match_id, status",
    )
    .eq("guild_id", guildId)
    .in("match_id", matchIds)
    .in("status", ["open", "claimed"]);

  if (error) throw error;
  if (!data?.length) return [];

  const out: UnclaimedAssignmentAlertRow[] = [];
  for (const raw of data as AssignmentDbRow[]) {
    if (!raw.match_id || assignmentFullyClaimed(raw)) continue;
    const match = matchById.get(raw.match_id);
    if (!match) continue;

    const mainClaimed =
      slotFilled(raw.main_claimed_by_discord_id) ||
      slotFilled(raw.claimed_by_discord_id);

    out.push({
      assignment_id: raw.id,
      guild_id: raw.guild_id,
      channel_id: raw.channel_id,
      message_id: raw.message_id,
      season: raw.season,
      competition: raw.competition,
      game_week_label: raw.game_week_label,
      home_team_name: raw.home_team_name,
      away_team_name: raw.away_team_name,
      match_id: raw.match_id,
      scheduled_at: match.scheduled_at,
      roblox_match_id: match.roblox_match_id,
      home_slug: match.home_slug,
      away_slug: match.away_slug,
      missing_main: !mainClaimed,
      missing_linesman: !slotFilled(raw.linesman_claimed_by_discord_id),
    });
  }

  return out;
}

export async function claimUnclaimedAlertSlot(
  supabase: SupabaseClient,
  assignmentId: string,
): Promise<boolean> {
  const { error } = await supabase
    .from("referee_assignment_unclaimed_alerts")
    .insert({ assignment_id: assignmentId });

  if (error) {
    if (error.code === "23505") return false;
    throw error;
  }
  return true;
}

export async function releaseUnclaimedAlertSlot(
  supabase: SupabaseClient,
  assignmentId: string,
): Promise<void> {
  await supabase
    .from("referee_assignment_unclaimed_alerts")
    .delete()
    .eq("assignment_id", assignmentId);
}
