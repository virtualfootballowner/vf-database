import { createBotSupabase } from "@/bot/stats-queries";

export type RefereeStatus =
  | "pending"
  | "active"
  | "denied"
  | "suspended"
  | "removed";

export type RefereeRow = {
  id: string;
  discord_id: string;
  discord_username: string | null;
  roblox_user_id: string | null;
  roblox_username: string | null;
  status: RefereeStatus;
  tier: string | null;
  notes: string | null;
  approved_by_discord_id: string | null;
  approved_at: string | null;
  denied_by_discord_id: string | null;
  denied_at: string | null;
  created_at: string;
  updated_at: string;
};

export type RefereeAssignmentRow = {
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
  referee_id: string | null;
  claimed_by_discord_id: string | null;
  claimed_at: string | null;
  match_id: string | null;
  created_at: string;
  updated_at: string;
};

export function refereeDisplayName(row: Pick<
  RefereeRow,
  "roblox_username" | "discord_username" | "discord_id"
>): string {
  const rbx = row.roblox_username?.trim();
  if (rbx) return rbx;
  const disc = row.discord_username?.trim();
  if (disc) return disc;
  return row.discord_id;
}

export async function findRefereeByDiscordId(
  discordId: string,
): Promise<RefereeRow | null> {
  const supabase = createBotSupabase();
  const { data, error } = await supabase
    .from("referees")
    .select("*")
    .eq("discord_id", discordId)
    .maybeSingle();
  if (error) {
    console.error("[referee] find by discord:", error);
    return null;
  }
  return (data as RefereeRow | null) ?? null;
}

export async function approveReferee(input: {
  discordId: string;
  approvedByDiscordId: string;
}): Promise<{ ok: boolean; row?: RefereeRow; error?: string }> {
  const supabase = createBotSupabase();
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("referees")
    .update({
      status: "active",
      approved_by_discord_id: input.approvedByDiscordId,
      approved_at: now,
      updated_at: now,
    })
    .eq("discord_id", input.discordId)
    .select("*")
    .maybeSingle();
  if (error || !data) {
    console.error("[referee] approve:", error);
    return { ok: false, error: "Could not approve that application in the database." };
  }
  return { ok: true, row: data as RefereeRow };
}

export async function denyReferee(input: {
  discordId: string;
  deniedByDiscordId: string;
}): Promise<{ ok: boolean; error?: string }> {
  const supabase = createBotSupabase();
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("referees")
    .update({
      status: "denied",
      denied_by_discord_id: input.deniedByDiscordId,
      denied_at: now,
      updated_at: now,
    })
    .eq("discord_id", input.discordId);
  if (error) {
    console.error("[referee] deny:", error);
    return { ok: false, error: "Could not update application status." };
  }
  return { ok: true };
}

export async function listActiveReferees(limit = 25): Promise<RefereeRow[]> {
  const supabase = createBotSupabase();
  const { data, error } = await supabase
    .from("referees")
    .select("*")
    .eq("status", "active")
    .order("approved_at", { ascending: false, nullsFirst: false })
    .limit(limit);
  if (error) {
    console.error("[referee] list active:", error);
    return [];
  }
  return (data ?? []) as RefereeRow[];
}

export async function countRefereeAssignments(
  refereeId: string,
): Promise<number> {
  const supabase = createBotSupabase();
  const { count, error } = await supabase
    .from("referee_assignments")
    .select("id", { count: "exact", head: true })
    .eq("referee_id", refereeId)
    .in("status", ["claimed", "completed"]);
  if (error) {
    console.error("[referee] assignment count:", error);
    return 0;
  }
  return count ?? 0;
}

export async function syncMatchRefereeFromAssignment(input: {
  matchId: string | null | undefined;
  season: number;
  competition: string;
  homeTeamName: string;
  awayTeamName: string;
  refereeLabel: string;
}): Promise<void> {
  const supabase = createBotSupabase();
  const label = input.refereeLabel.trim();
  if (!label) return;

  let matchId = input.matchId?.trim() || null;
  if (!matchId) {
    const { data: rows } = await supabase
      .from("matches")
      .select("id")
      .eq("season", input.season)
      .ilike("competition", input.competition.trim())
      .ilike("home_team", input.homeTeamName.trim())
      .ilike("away_team", input.awayTeamName.trim())
      .order("played_on", { ascending: false })
      .limit(1);
    matchId = rows?.[0]?.id ?? null;
  }
  if (!matchId) return;

  const { error } = await supabase
    .from("matches")
    .update({ referee: label })
    .eq("id", matchId);
  if (error) {
    console.error("[referee] sync match referee:", error);
  }
}