import type { Client, GuildTextBasedChannel } from "discord.js";

import {
  buildAssignmentKickoffLabel,
  postRefereeAssignment,
  refreshRefereeAssignmentMessage,
  systemReleaseAssignmentSlot,
} from "@/bot/referees/assignments";
import {
  refereeAssignmentsChannelId,
  refereeGuildId,
  refereeRoleId,
} from "@/bot/referees/config";
import {
  cancelAssignment,
  fetchLatestAssignmentForMatch,
  fetchMatchForRefereeRepost,
  fetchPostponementResponsesForBatch,
  type MatchForRefereeRepost,
  type PostponementResponseRow,
} from "@/bot/referees/postponement/queries";
import type { RefereeAssignmentRow } from "@/bot/referees/queries";
import { createBotSupabase } from "@/bot/stats-queries";
import { discordTeamLabel } from "@/bot/discord-team-flags";

async function resolveAssignmentsChannel(
  client: Client,
): Promise<GuildTextBasedChannel | null> {
  const channelId = refereeAssignmentsChannelId();
  try {
    const ch = await client.channels.fetch(channelId);
    if (!ch?.isTextBased() || !ch.isSendable()) return null;
    return ch as GuildTextBasedChannel;
  } catch (e) {
    console.error("[referee-postpone] assignments channel fetch:", e);
    return null;
  }
}

/** Fresh open claim embed — same shape as `/ref-fixtures` posts per match. */
async function postPostponedRefFixture(
  client: Client,
  match: MatchForRefereeRepost,
  newScheduledAt: string,
  postedBy: { discordId: string; tag: string },
): Promise<boolean> {
  const channel = await resolveAssignmentsChannel(client);
  if (!channel) {
    console.error(
      "[referee-postpone] assignments channel missing — set DISCORD_REFEREE_ASSIGNMENTS_CHANNEL_ID",
    );
    return false;
  }

  const kickoffLabel = buildAssignmentKickoffLabel(newScheduledAt);
  const result = await postRefereeAssignment({
    client,
    guildId: refereeGuildId(),
    channel,
    postedByDiscordId: postedBy.discordId,
    postedByDiscordTag: postedBy.tag,
    season: match.season ?? 0,
    competition: match.competition?.trim() || "—",
    gameWeekLabel: match.game_week_label,
    homeTeamName: match.home_name,
    awayTeamName: match.away_name,
    homeTeamSlug: match.home_slug,
    awayTeamSlug: match.away_slug,
    kickoffLabel,
    matchId: match.id,
    robloxMatchId: match.roblox_match_id,
    scheduledAtIso: newScheduledAt,
  });

  if (!result.ok) {
    console.error("[referee-postpone] repost failed:", result.error);
    return false;
  }

  const matchLine = `${discordTeamLabel(match.home_name, match.home_slug)} vs ${discordTeamLabel(match.away_name, match.away_slug)}`;
  const roleId = refereeRoleId();
  await channel.send({
    content: `<@&${roleId}> 📅 **POSTPONED** — ${matchLine} has a **new kickoff** (${kickoffLabel}). Claim **Main ref** or **Linesman** on the fixture above!`,
    allowedMentions: { roles: [roleId] },
  });

  return true;
}

async function refreshAssignmentKickoffOnly(
  client: Client,
  assignment: RefereeAssignmentRow,
  newScheduledAt: string,
  match: MatchForRefereeRepost | null,
): Promise<void> {
  const supabase = createBotSupabase();
  const kickoffLabel = buildAssignmentKickoffLabel(newScheduledAt);
  const now = new Date().toISOString();
  await supabase
    .from("referee_assignments")
    .update({ kickoff_label: kickoffLabel, updated_at: now })
    .eq("id", assignment.id);

  const { data: fresh } = await supabase
    .from("referee_assignments")
    .select("*")
    .eq("id", assignment.id)
    .maybeSingle();
  if (!fresh) return;

  await refreshRefereeAssignmentMessage(client, fresh as RefereeAssignmentRow, {
    robloxMatchId: match?.roblox_match_id ?? null,
    scheduledAtIso: newScheduledAt,
    homeTeamSlug: match?.home_slug,
    awayTeamSlug: match?.away_slug,
  });
}

async function repostFixtureForReferees(
  client: Client,
  assignment: RefereeAssignmentRow,
  newScheduledAt: string,
): Promise<void> {
  const supabase = createBotSupabase();
  const match = await fetchMatchForRefereeRepost(supabase, assignment.match_id!);
  if (!match) {
    console.error("[referee-postpone] repost: match missing");
    return;
  }

  await cancelAssignment(supabase, assignment.id);

  const ok = await postPostponedRefFixture(client, match, newScheduledAt, {
    discordId: assignment.posted_by_discord_id,
    tag: assignment.posted_by_discord_tag ?? "VF Bot",
  });

  if (ok) {
    console.log(
      `[referee-postpone] reposted assignment for match ${match.id.slice(0, 8)}…`,
    );
  }
}

export async function evaluatePostponementBatch(
  client: Client,
  assignmentId: string,
  newScheduledAt: string,
): Promise<void> {
  const supabase = createBotSupabase();
  const responses = await fetchPostponementResponsesForBatch(
    supabase,
    assignmentId,
    newScheduledAt,
  );
  if (responses.length === 0) return;
  if (responses.some((r) => r.status === "pending")) return;

  const { data: assignmentRow } = await supabase
    .from("referee_assignments")
    .select("*")
    .eq("id", assignmentId)
    .maybeSingle();
  if (!assignmentRow) return;
  const assignment = assignmentRow as RefereeAssignmentRow;
  if (assignment.status === "cancelled") return;

  const match = assignment.match_id
    ? await fetchMatchForRefereeRepost(supabase, assignment.match_id)
    : null;

  if (responses.some((r) => r.status === "declined")) {
    await repostFixtureForReferees(client, assignment, newScheduledAt);
    return;
  }

  await refreshAssignmentKickoffOnly(client, assignment, newScheduledAt, match);
  console.log(
    `[referee-postpone] all refs confirmed new time for assignment ${assignmentId.slice(0, 8)}…`,
  );
}

/**
 * When a fixture is rescheduled, cancel the old ref claim post and publish a
 * fresh open embed in the assignments channel so officials can reclaim slots.
 */
export async function notifyRefereesOfMatchPostponement(
  client: Client,
  matchId: string,
  newScheduledAt: string,
): Promise<void> {
  const supabase = createBotSupabase();
  const match = await fetchMatchForRefereeRepost(supabase, matchId);
  if (!match) {
    console.error("[referee-postpone] match missing for", matchId);
    return;
  }

  const assignment = await fetchLatestAssignmentForMatch(supabase, matchId);
  const postedBy = {
    discordId: assignment?.posted_by_discord_id ?? "0",
    tag: assignment?.posted_by_discord_tag ?? "VF Bot · postponement",
  };

  if (assignment) {
    await supabase
      .from("referee_postponement_responses")
      .delete()
      .eq("assignment_id", assignment.id);
    await cancelAssignment(supabase, assignment.id);
  }

  const ok = await postPostponedRefFixture(client, match, newScheduledAt, postedBy);
  if (ok) {
    console.log(
      `[referee-postpone] posted fresh ref fixture for match ${matchId.slice(0, 8)}… → ${refereeAssignmentsChannelId()}`,
    );
  }
}

export async function applyPostponementRefereeResponse(
  client: Client,
  response: PostponementResponseRow,
  action: "confirmed" | "declined",
): Promise<void> {
  if (action === "declined") {
    await systemReleaseAssignmentSlot(
      client,
      response.assignment_id,
      response.slot,
    );
  }

  await evaluatePostponementBatch(
    client,
    response.assignment_id,
    response.new_scheduled_at,
  );
}
