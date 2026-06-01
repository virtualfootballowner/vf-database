import { randomUUID } from "crypto";

import { EmbedBuilder, type Client, type GuildTextBasedChannel } from "discord.js";

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
  buildPostponementRefereeActionRow,
  buildPostponementRefereeDmEmbed,
} from "@/bot/referees/postponement/messages";
import {
  cancelAssignment,
  claimedSlotsForAssignment,
  fetchLatestAssignmentForMatch,
  fetchMatchForRefereeRepost,
  fetchPostponementResponsesForBatch,
  insertPostponementResponse,
  type PostponementResponseRow,
} from "@/bot/referees/postponement/queries";
import type { RefereeAssignmentRow } from "@/bot/referees/queries";
import { createBotSupabase } from "@/bot/stats-queries";
import { discordTeamLabel } from "@/bot/discord-team-flags";

async function dmReferee(
  client: Client,
  discordId: string,
  payload: {
    embeds: EmbedBuilder[];
    components: ReturnType<typeof buildPostponementRefereeActionRow>[];
  },
): Promise<string | null> {
  try {
    const user = await client.users.fetch(discordId);
    const msg = await user.send(payload);
    return msg.id;
  } catch (e) {
    console.error(`[referee-postpone] DM failed for ${discordId}:`, e);
    return null;
  }
}

async function resolveAssignmentsChannel(
  client: Client,
): Promise<GuildTextBasedChannel | null> {
  const channelId = refereeAssignmentsChannelId();
  if (!channelId) return null;
  try {
    const ch = await client.channels.fetch(channelId);
    if (!ch?.isTextBased() || !ch.isSendable()) return null;
    return ch as GuildTextBasedChannel;
  } catch {
    return null;
  }
}

async function refreshAssignmentKickoffOnly(
  client: Client,
  assignment: RefereeAssignmentRow,
  newScheduledAt: string,
  match: Awaited<ReturnType<typeof fetchMatchForRefereeRepost>>,
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
  const channel = await resolveAssignmentsChannel(client);
  const match = await fetchMatchForRefereeRepost(supabase, assignment.match_id!);
  if (!channel || !match) {
    console.error("[referee-postpone] repost: channel or match missing");
    return;
  }

  await cancelAssignment(supabase, assignment.id);

  const kickoffLabel = buildAssignmentKickoffLabel(newScheduledAt);
  const result = await postRefereeAssignment({
    client,
    guildId: refereeGuildId(),
    channel,
    postedByDiscordId: assignment.posted_by_discord_id,
    postedByDiscordTag: assignment.posted_by_discord_tag ?? "VF Bot",
    season: match.season ?? assignment.season,
    competition: match.competition?.trim() || assignment.competition,
    gameWeekLabel: match.game_week_label ?? assignment.game_week_label,
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
    return;
  }

  const matchLine = `${discordTeamLabel(match.home_name, match.home_slug)} vs ${discordTeamLabel(match.away_name, match.away_slug)}`;
  const roleId = refereeRoleId();
  await channel.send({
    content: `<@&${roleId}> 👆 **POSTPONED** — ${matchLine} needs officials at the **new kickoff**. Claim **Main ref** or **Linesman** above!`,
    allowedMentions: { roles: [roleId] },
  });

  console.log(
    `[referee-postpone] reposted assignment for match ${match.id.slice(0, 8)}…`,
  );
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

export async function notifyRefereesOfMatchPostponement(
  client: Client,
  matchId: string,
  newScheduledAt: string,
): Promise<void> {
  const supabase = createBotSupabase();
  const assignment = await fetchLatestAssignmentForMatch(supabase, matchId);
  if (!assignment?.match_id) return;

  const match = await fetchMatchForRefereeRepost(supabase, matchId);
  const slots = claimedSlotsForAssignment(assignment);

  if (slots.length === 0) {
    await refreshAssignmentKickoffOnly(
      client,
      assignment,
      newScheduledAt,
      match,
    );
    return;
  }

  await supabase
    .from("referee_postponement_responses")
    .delete()
    .eq("assignment_id", assignment.id)
    .eq("status", "pending");

  for (const { slot, discordId } of slots) {
    const responseId = randomUUID();
    const row = await insertPostponementResponse(supabase, {
      id: responseId,
      assignmentId: assignment.id,
      matchId,
      discordId,
      slot,
      newScheduledAt,
    });
    if (!row) continue;

    const embed = buildPostponementRefereeDmEmbed(assignment, slot, newScheduledAt, {
      homeSlug: match?.home_slug,
      awaySlug: match?.away_slug,
    });
    const dmMessageId = await dmReferee(client, discordId, {
      embeds: [embed],
      components: [buildPostponementRefereeActionRow(responseId)],
    });

    if (dmMessageId) {
      await supabase
        .from("referee_postponement_responses")
        .update({ dm_message_id: dmMessageId, updated_at: new Date().toISOString() })
        .eq("id", responseId);
    }
  }

  console.log(
    `[referee-postpone] notified ${slots.length} ref(s) for match ${matchId.slice(0, 8)}…`,
  );
}

export async function applyPostponementRefereeResponse(
  client: Client,
  response: PostponementResponseRow,
  action: "confirmed" | "declined",
): Promise<void> {
  const supabase = createBotSupabase();

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
