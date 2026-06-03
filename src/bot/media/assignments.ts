import { randomUUID } from "crypto";

import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  MessageFlags,
  PermissionFlagsBits,
  type ButtonInteraction,
  type ChatInputCommandInteraction,
  type Client,
  type GuildMember,
  type GuildTextBasedChannel,
} from "discord.js";

import {
  isMediaGuild,
  mediaAssignmentsChannelId,
  mediaCommentatorRoleId,
  mediaStaffRoleId,
  mediaStreamerRoleId,
} from "@/bot/media/config";
import {
  cancelPreviousMediaAssignmentsForMatches,
  loadMediaAssignment,
  mediaAssignmentBothSlotsFilled,
  mediaAssignmentStatusFromSlots,
  type MediaAssignmentRow,
} from "@/bot/media/queries";
import {
  fetchNextMatchweekBundle,
  type RefMatchweekBundle,
} from "@/bot/referees/matchweek";
import { buildAssignmentKickoffLabel } from "@/bot/referees/assignments";
import { createBotSupabase } from "@/bot/stats-queries";
import { discordTeamLabel } from "@/bot/discord-team-flags";
import { env } from "@/bot/config";
import {
  MEDIA_SLOT_CLAIM_COMMENTATOR,
  MEDIA_SLOT_CLAIM_STREAMER,
  MEDIA_SLOT_UNCLAIM_COMMENTATOR,
  MEDIA_SLOT_UNCLAIM_STREAMER,
  type MediaAssignmentSlot,
} from "@/lib/media/discord-constants";
import { formatDualTimezoneKickoffTime } from "@/lib/wc-fixture-kickoff";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const COLOR_OPEN = 0x6366f1;
const COLOR_FULL = 0x10b981;
const FIXTURE_POST_DELAY_MS = 350;

function siteBase(): string {
  return env.VFL_SITE_URL.replace(/\/$/, "");
}

function fixturePageUrl(robloxMatchId: string | null | undefined): string | null {
  const code = robloxMatchId?.trim();
  if (!code) return null;
  return `${siteBase()}/stats/matches/${encodeURIComponent(code)}`;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function ensureMediaGuild(interaction: {
  guildId: string | null;
  reply: (opts: object) => Promise<unknown>;
}): boolean {
  if (!isMediaGuild(interaction.guildId)) {
    void interaction.reply({
      flags: MessageFlags.Ephemeral,
      content: "This command is only available in the VF Media server.",
    });
    return false;
  }
  return true;
}

function isMediaStaff(member: GuildMember): boolean {
  if (
    member.permissions.has(PermissionFlagsBits.ManageRoles) ||
    member.permissions.has(PermissionFlagsBits.ManageGuild)
  ) {
    return true;
  }
  return member.roles.cache.has(mediaStaffRoleId());
}

function memberHasSlotRole(
  member: GuildMember,
  slot: MediaAssignmentSlot,
): boolean {
  if (slot === "streamer") {
    return member.roles.cache.has(mediaStreamerRoleId());
  }
  return member.roles.cache.has(mediaCommentatorRoleId());
}

function slotRoleLabel(slot: MediaAssignmentSlot): string {
  return slot === "streamer" ? "Streamer" : "Commentator";
}

async function fetchGuildMember(
  interaction: ButtonInteraction | ChatInputCommandInteraction,
): Promise<GuildMember> {
  let member = interaction.member as GuildMember;
  try {
    if (interaction.guild) {
      member = await interaction.guild.members.fetch(interaction.user.id);
    }
  } catch {
    /* keep cached */
  }
  return member;
}

async function resolveSendableChannel(
  client: Client,
  channelId: string,
): Promise<GuildTextBasedChannel | null> {
  try {
    const ch = await client.channels.fetch(channelId);
    if (!ch?.isTextBased() || !ch.isSendable()) return null;
    return ch as GuildTextBasedChannel;
  } catch {
    return null;
  }
}

function kickoffUnix(iso: string | null | undefined): number | null {
  if (!iso?.trim()) return null;
  const ms = new Date(iso).getTime();
  if (Number.isNaN(ms)) return null;
  return Math.floor(ms / 1000);
}

function buildKickoffFieldValue(
  kickoffLabel: string | null | undefined,
  scheduledAtIso?: string | null,
): string | null {
  if (scheduledAtIso?.trim()) {
    return buildAssignmentKickoffLabel(scheduledAtIso);
  }
  const label = kickoffLabel?.trim();
  if (!label) return null;
  const ts = kickoffUnix(label);
  if (ts != null) {
    return `${formatDualTimezoneKickoffTime(label)}\n<t:${ts}:f> · <t:${ts}:R>`;
  }
  return label;
}

function slotDiscordId(
  row: MediaAssignmentRow,
  slot: MediaAssignmentSlot,
): string | null {
  if (slot === "streamer") return row.streamer_claimed_by_discord_id;
  return row.commentator_claimed_by_discord_id;
}

function slotDisplayName(
  row: MediaAssignmentRow,
  slot: MediaAssignmentSlot,
): string | null {
  if (slot === "streamer") return row.streamer_display_name;
  return row.commentator_display_name;
}

function slotOpen(row: MediaAssignmentRow, slot: MediaAssignmentSlot): boolean {
  return !slotDiscordId(row, slot)?.trim();
}

function userOwnsSlot(
  row: MediaAssignmentRow,
  userId: string,
  slot: MediaAssignmentSlot,
): boolean {
  return slotDiscordId(row, slot) === userId;
}

function formatSlotValue(
  discordId: string | null | undefined,
  displayLabel?: string | null,
): string {
  if (!discordId?.trim()) return "*Open*";
  if (displayLabel?.trim()) {
    return `${displayLabel.trim()} (<@${discordId}>)`;
  }
  return `<@${discordId}>`;
}

function formatMatchField(
  homeName: string,
  awayName: string,
  homeSlug?: string | null,
  awaySlug?: string | null,
): string {
  return `${discordTeamLabel(homeName, homeSlug)} vs ${discordTeamLabel(awayName, awaySlug)}`;
}

function mediaDisplayName(
  interaction: ButtonInteraction | ChatInputCommandInteraction,
): string {
  const user = interaction.user;
  return user.globalName?.trim() || user.username;
}

function buildAssignmentEmbed(
  row: MediaAssignmentRow,
  options?: {
    robloxMatchId?: string | null;
    scheduledAtIso?: string | null;
    streamerLabel?: string;
    commentatorLabel?: string;
    homeTeamSlug?: string | null;
    awayTeamSlug?: string | null;
  },
): EmbedBuilder {
  const bothFilled = mediaAssignmentBothSlotsFilled(row);
  const embed = new EmbedBuilder()
    .setColor(bothFilled ? COLOR_FULL : COLOR_OPEN)
    .setTitle(
      bothFilled ? "Fixture · fully assigned" : "Fixture · open for media",
    )
    .addFields(
      { name: "Season", value: String(row.season), inline: true },
      { name: "Competition", value: row.competition, inline: true },
      {
        name: "Game week",
        value: row.game_week_label ?? "—",
        inline: true,
      },
      {
        name: "Match",
        value: formatMatchField(
          row.home_team_name,
          row.away_team_name,
          options?.homeTeamSlug,
          options?.awayTeamSlug,
        ),
        inline: false,
      },
      {
        name: "Streamer",
        value: formatSlotValue(
          slotDiscordId(row, "streamer"),
          options?.streamerLabel ?? slotDisplayName(row, "streamer"),
        ),
        inline: true,
      },
      {
        name: "Commentator",
        value: formatSlotValue(
          slotDiscordId(row, "commentator"),
          options?.commentatorLabel ??
            slotDisplayName(row, "commentator"),
        ),
        inline: true,
      },
    )
    .setFooter({ text: `Assignment ${row.id.slice(0, 8)}…` })
    .setTimestamp(new Date());

  const kickoff = buildKickoffFieldValue(row.kickoff_label, options?.scheduledAtIso);
  if (kickoff) {
    embed.addFields({ name: "Kickoff", value: kickoff, inline: false });
  }

  const fixtureUrl = fixturePageUrl(options?.robloxMatchId ?? null);
  if (fixtureUrl) {
    embed.addFields({
      name: "Fixture",
      value: `[View on VF](${fixtureUrl})`,
      inline: false,
    });
  }

  return embed;
}

function buildAssignmentComponents(
  row: MediaAssignmentRow,
): ActionRowBuilder<ButtonBuilder>[] {
  const buttons: ButtonBuilder[] = [];

  if (slotOpen(row, "streamer")) {
    buttons.push(
      new ButtonBuilder()
        .setCustomId(`${MEDIA_SLOT_CLAIM_STREAMER}${row.id}`)
        .setLabel("Claim streamer")
        .setStyle(ButtonStyle.Success),
    );
  } else {
    buttons.push(
      new ButtonBuilder()
        .setCustomId(`${MEDIA_SLOT_UNCLAIM_STREAMER}${row.id}`)
        .setLabel("Unclaim streamer")
        .setStyle(ButtonStyle.Danger),
    );
  }

  if (slotOpen(row, "commentator")) {
    buttons.push(
      new ButtonBuilder()
        .setCustomId(`${MEDIA_SLOT_CLAIM_COMMENTATOR}${row.id}`)
        .setLabel("Claim commentator")
        .setStyle(ButtonStyle.Success),
    );
  } else {
    buttons.push(
      new ButtonBuilder()
        .setCustomId(`${MEDIA_SLOT_UNCLAIM_COMMENTATOR}${row.id}`)
        .setLabel("Unclaim commentator")
        .setStyle(ButtonStyle.Danger),
    );
  }

  return [new ActionRowBuilder<ButtonBuilder>().addComponents(buttons)];
}

async function fetchRobloxMatchIdForAssignment(
  matchId: string | null | undefined,
): Promise<string | null> {
  const id = matchId?.trim();
  if (!id) return null;
  const supabase = createBotSupabase();
  const { data, error } = await supabase
    .from("matches")
    .select("roblox_match_id")
    .eq("id", id)
    .maybeSingle();
  if (error) {
    console.error("[media] fetch roblox_match_id:", error);
    return null;
  }
  return (data as { roblox_match_id?: string | null } | null)?.roblox_match_id ?? null;
}

async function editAssignmentMessage(
  client: Client,
  row: MediaAssignmentRow,
  options?: {
    robloxMatchId?: string | null;
    scheduledAtIso?: string | null;
    streamerLabel?: string;
    commentatorLabel?: string;
    homeTeamSlug?: string | null;
    awayTeamSlug?: string | null;
  },
): Promise<void> {
  if (!row.channel_id || !row.message_id) return;
  try {
    const ch = await client.channels.fetch(row.channel_id);
    if (!ch?.isTextBased()) return;
    const msg = await ch.messages.fetch(row.message_id);
    await msg.edit({
      embeds: [buildAssignmentEmbed(row, options)],
      components: buildAssignmentComponents(row),
    });
  } catch (e) {
    console.error("[media] assignment message edit:", e);
  }
}

async function requireSlotRole(
  interaction: ButtonInteraction,
  slot: MediaAssignmentSlot,
): Promise<boolean> {
  const member = await fetchGuildMember(interaction);
  if (!memberHasSlotRole(member, slot)) {
    await interaction.reply({
      flags: MessageFlags.Ephemeral,
      content: `You need the **${slotRoleLabel(slot)}** role to claim that slot.`,
    });
    return false;
  }
  return true;
}

function slotClaimUpdate(
  row: MediaAssignmentRow,
  slot: MediaAssignmentSlot,
  discordId: string,
  displayName: string,
  now: string,
): Record<string, unknown> {
  const next: MediaAssignmentRow = { ...row };
  if (slot === "streamer") {
    next.streamer_claimed_by_discord_id = discordId;
    next.streamer_claimed_at = now;
    next.streamer_display_name = displayName;
  } else {
    next.commentator_claimed_by_discord_id = discordId;
    next.commentator_claimed_at = now;
    next.commentator_display_name = displayName;
  }
  next.status = mediaAssignmentStatusFromSlots(next);
  next.updated_at = now;

  const update: Record<string, unknown> = {
    status: next.status,
    updated_at: now,
  };
  if (slot === "streamer") {
    update.streamer_claimed_by_discord_id = discordId;
    update.streamer_claimed_at = now;
    update.streamer_display_name = displayName;
  } else {
    update.commentator_claimed_by_discord_id = discordId;
    update.commentator_claimed_at = now;
    update.commentator_display_name = displayName;
  }
  return update;
}

function slotUnclaimUpdate(
  row: MediaAssignmentRow,
  slot: MediaAssignmentSlot,
  now: string,
): Record<string, unknown> {
  const next: MediaAssignmentRow = { ...row };
  if (slot === "streamer") {
    next.streamer_claimed_by_discord_id = null;
    next.streamer_claimed_at = null;
    next.streamer_display_name = null;
  } else {
    next.commentator_claimed_by_discord_id = null;
    next.commentator_claimed_at = null;
    next.commentator_display_name = null;
  }
  next.status = mediaAssignmentStatusFromSlots(next);
  next.updated_at = now;

  const update: Record<string, unknown> = {
    status: next.status,
    updated_at: now,
  };
  if (slot === "streamer") {
    update.streamer_claimed_by_discord_id = null;
    update.streamer_claimed_at = null;
    update.streamer_display_name = null;
  } else {
    update.commentator_claimed_by_discord_id = null;
    update.commentator_claimed_at = null;
    update.commentator_display_name = null;
  }
  return update;
}

type PostMediaAssignmentInput = {
  client: Client;
  guildId: string;
  channel: GuildTextBasedChannel;
  postedByDiscordId: string;
  postedByDiscordTag: string;
  season: number;
  competition: string;
  gameWeekLabel: string | null;
  homeTeamName: string;
  awayTeamName: string;
  homeTeamSlug?: string | null;
  awayTeamSlug?: string | null;
  kickoffLabel: string | null;
  matchId: string | null;
  robloxMatchId: string | null;
  scheduledAtIso?: string | null;
};

async function postMediaAssignmentRecord(
  input: PostMediaAssignmentInput,
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const assignmentId = randomUUID();
  const supabase = createBotSupabase();
  const now = new Date().toISOString();

  const { error: insErr } = await supabase.from("media_assignments").insert({
    id: assignmentId,
    guild_id: input.guildId,
    season: input.season,
    competition: input.competition,
    game_week_label: input.gameWeekLabel,
    home_team_name: input.homeTeamName,
    away_team_name: input.awayTeamName,
    kickoff_label: input.kickoffLabel,
    posted_by_discord_id: input.postedByDiscordId,
    posted_by_discord_tag: input.postedByDiscordTag,
    status: "open",
    match_id: input.matchId,
    created_at: now,
    updated_at: now,
  });

  if (insErr) {
    console.error("[media] assignment insert:", insErr);
    return {
      ok: false,
      error: "Could not create assignment in the database. Apply the latest migration.",
    };
  }

  const row: MediaAssignmentRow = {
    id: assignmentId,
    guild_id: input.guildId,
    channel_id: null,
    message_id: null,
    season: input.season,
    competition: input.competition,
    game_week_label: input.gameWeekLabel,
    home_team_name: input.homeTeamName,
    away_team_name: input.awayTeamName,
    kickoff_label: input.kickoffLabel,
    posted_by_discord_id: input.postedByDiscordId,
    posted_by_discord_tag: input.postedByDiscordTag,
    status: "open",
    streamer_claimed_by_discord_id: null,
    streamer_claimed_at: null,
    streamer_display_name: null,
    commentator_claimed_by_discord_id: null,
    commentator_claimed_at: null,
    commentator_display_name: null,
    match_id: input.matchId,
    created_at: now,
    updated_at: now,
  };

  let msg;
  try {
    msg = await input.channel.send({
      embeds: [
        buildAssignmentEmbed(row, {
          robloxMatchId: input.robloxMatchId,
          scheduledAtIso: input.scheduledAtIso,
          homeTeamSlug: input.homeTeamSlug,
          awayTeamSlug: input.awayTeamSlug,
        }),
      ],
      components: buildAssignmentComponents(row),
    });
  } catch (e) {
    console.error("[media] assignment channel send:", e);
    await supabase.from("media_assignments").delete().eq("id", assignmentId);
    return {
      ok: false,
      error: "Could not post to the assignments channel (check bot permissions).",
    };
  }

  await supabase
    .from("media_assignments")
    .update({
      channel_id: input.channel.id,
      message_id: msg.id,
      updated_at: now,
    })
    .eq("id", assignmentId);

  return { ok: true, url: msg.url };
}

export async function handleMediaFixturesCommand(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  if (!ensureMediaGuild(interaction)) return;
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const member = await fetchGuildMember(interaction);
  if (!isMediaStaff(member)) {
    await interaction.editReply({
      content: "Staff only — you need **Manage Roles** or the media staff role.",
    });
    return;
  }

  const channelId = mediaAssignmentsChannelId() ?? interaction.channelId;
  const channel = await resolveSendableChannel(interaction.client, channelId);
  if (!channel) {
    await interaction.editReply({
      content:
        "Could not reach the assignments channel. Set `DISCORD_MEDIA_ASSIGNMENTS_CHANNEL_ID` or run this in a channel the bot can post to.",
    });
    return;
  }

  const supabase = createBotSupabase();
  let bundle: RefMatchweekBundle;
  try {
    const next = await fetchNextMatchweekBundle(supabase);
    if (!next) {
      await interaction.editReply({
        content: "No upcoming scheduled fixtures found to post.",
      });
      return;
    }
    bundle = next;
  } catch (e) {
    console.error("[media] fetch matchweek bundle:", e);
    await interaction.editReply({
      content: "Could not load the next matchday from the database.",
    });
    return;
  }

  const matchIds = bundle.matches.map((m) => m.id);
  let replacedCount = 0;
  try {
    replacedCount = await cancelPreviousMediaAssignmentsForMatches(
      supabase,
      interaction.guild!.id,
      matchIds,
    );
  } catch (e) {
    console.error("[media] cancel previous assignments:", e);
    await interaction.editReply({
      content: "Could not reset previous assignment posts for this matchday.",
    });
    return;
  }

  const toPost = bundle.matches;
  const postedUrls: string[] = [];
  const failures: string[] = [];

  await channel.send({
    embeds: [
      new EmbedBuilder()
        .setColor(COLOR_OPEN)
        .setTitle(`${bundle.label} · ${bundle.competition}`)
        .setDescription(
          `Season **${bundle.season}** — claim **Streamer** or **Commentator** on each fixture below.`,
        )
        .setFooter({ text: `Posted by ${interaction.user.tag}` })
        .setTimestamp(),
    ],
  });

  for (let i = 0; i < toPost.length; i++) {
    const match = toPost[i]!;
    const kickoffLabel = buildAssignmentKickoffLabel(match.scheduled_at);
    const result = await postMediaAssignmentRecord({
      client: interaction.client,
      guildId: interaction.guild!.id,
      channel,
      postedByDiscordId: interaction.user.id,
      postedByDiscordTag: interaction.user.tag,
      season: bundle.season,
      competition: bundle.competition,
      gameWeekLabel: bundle.label,
      homeTeamName: match.home_name,
      awayTeamName: match.away_name,
      homeTeamSlug: match.home_slug,
      awayTeamSlug: match.away_slug,
      kickoffLabel,
      matchId: match.id,
      robloxMatchId: match.roblox_match_id,
      scheduledAtIso: match.scheduled_at,
    });

    if (result.ok) {
      postedUrls.push(result.url);
    } else {
      failures.push(
        `**${match.home_name}** vs **${match.away_name}**: ${result.error}`,
      );
    }

    if (i < toPost.length - 1) {
      await sleep(FIXTURE_POST_DELAY_MS);
    }
  }

  if (postedUrls.length > 0) {
    const streamerRole = mediaStreamerRoleId();
    const commentatorRole = mediaCommentatorRoleId();
    await channel.send({
      content: `<@&${streamerRole}> <@&${commentatorRole}> 👆 **${bundle.label}** fixtures are up above — go claim **Streamer** or **Commentator** on the matches you can cover!`,
      allowedMentions: { roles: [streamerRole, commentatorRole] },
    });
  }

  const lines = [
    `Posted **${postedUrls.length}** fixture(s) for **${bundle.label}** (${bundle.competition}).`,
  ];
  if (replacedCount > 0) {
    lines.push(
      `Replaced **${replacedCount}** previous assignment post(s) for this matchday.`,
    );
  }
  if (failures.length > 0) {
    lines.push("", "**Failures:**", ...failures.slice(0, 8));
  }

  await interaction.editReply({
    content: lines.join("\n").slice(0, 2000),
  });
}

export async function handleMediaAssignmentSlotButton(
  interaction: ButtonInteraction,
  action: "claim" | "unclaim",
  slot: MediaAssignmentSlot,
  assignmentIdRaw: string,
): Promise<void> {
  if (!ensureMediaGuild(interaction)) return;

  const assignmentId = assignmentIdRaw.trim();
  if (!UUID_RE.test(assignmentId)) {
    await interaction.reply({
      flags: MessageFlags.Ephemeral,
      content: "Invalid assignment link.",
    });
    return;
  }

  if (action === "claim") {
    await claimAssignmentSlot(interaction, slot, assignmentId);
    return;
  }

  await unclaimAssignmentSlot(interaction, slot, assignmentId);
}

async function claimAssignmentSlot(
  interaction: ButtonInteraction,
  slot: MediaAssignmentSlot,
  assignmentId: string,
): Promise<void> {
  if (!(await requireSlotRole(interaction, slot))) return;

  const row = await loadMediaAssignment(assignmentId);
  if (!row) {
    await interaction.reply({
      flags: MessageFlags.Ephemeral,
      content: "That assignment could not be found.",
    });
    return;
  }

  if (row.status === "cancelled" || row.status === "completed") {
    await interaction.reply({
      flags: MessageFlags.Ephemeral,
      content: "This assignment is no longer available.",
    });
    return;
  }

  if (!slotOpen(row, slot)) {
    const whoId = slotDiscordId(row, slot);
    await interaction.reply({
      flags: MessageFlags.Ephemeral,
      content: whoId
        ? `That slot was already taken by <@${whoId}>.`
        : "That slot is no longer available.",
    });
    return;
  }

  const otherSlot: MediaAssignmentSlot =
    slot === "streamer" ? "commentator" : "streamer";
  if (userOwnsSlot(row, interaction.user.id, otherSlot)) {
    await interaction.reply({
      flags: MessageFlags.Ephemeral,
      content:
        "You cannot claim both the streamer and commentator slots on the same fixture.",
    });
    return;
  }

  const now = new Date().toISOString();
  const label = mediaDisplayName(interaction);
  const update = slotClaimUpdate(
    row,
    slot,
    interaction.user.id,
    label,
    now,
  );
  const supabase = createBotSupabase();

  let query = supabase
    .from("media_assignments")
    .update(update)
    .eq("id", assignmentId);

  if (slot === "streamer") {
    query = query.is("streamer_claimed_by_discord_id", null);
  } else {
    query = query.is("commentator_claimed_by_discord_id", null);
  }

  const { data: updated, error: updErr } = await query.select("*").maybeSingle();

  if (updErr || !updated) {
    await interaction.reply({
      flags: MessageFlags.Ephemeral,
      content: updErr
        ? "Could not claim that slot right now."
        : "Someone else just claimed it.",
    });
    return;
  }

  const claimedRow = updated as MediaAssignmentRow;
  const robloxMatchId = await fetchRobloxMatchIdForAssignment(claimedRow.match_id);

  await interaction.deferUpdate();
  await editAssignmentMessage(interaction.client, claimedRow, {
    robloxMatchId,
    streamerLabel:
      slot === "streamer"
        ? label
        : (slotDisplayName(claimedRow, "streamer") ?? undefined),
    commentatorLabel:
      slot === "commentator"
        ? label
        : (slotDisplayName(claimedRow, "commentator") ?? undefined),
  });

  const slotLabel = slotRoleLabel(slot).toLowerCase();
  try {
    await interaction.followUp({
      flags: MessageFlags.Ephemeral,
      content: `You claimed **${slotLabel}** for **${claimedRow.home_team_name}** vs **${claimedRow.away_team_name}**.`,
    });
  } catch {
    /* ignore */
  }
}

async function unclaimAssignmentSlot(
  interaction: ButtonInteraction,
  slot: MediaAssignmentSlot,
  assignmentId: string,
): Promise<void> {
  const member = await fetchGuildMember(interaction);
  const row = await loadMediaAssignment(assignmentId);
  if (!row) {
    await interaction.reply({
      flags: MessageFlags.Ephemeral,
      content: "That assignment could not be found.",
    });
    return;
  }

  if (row.status === "cancelled" || row.status === "completed") {
    await interaction.reply({
      flags: MessageFlags.Ephemeral,
      content: "This assignment can no longer be changed.",
    });
    return;
  }

  const staff = isMediaStaff(member);
  const ownsSlot = userOwnsSlot(row, interaction.user.id, slot);

  if (!staff && !ownsSlot) {
    await interaction.reply({
      flags: MessageFlags.Ephemeral,
      content: "You can only unclaim slots you have claimed (staff can unclaim any).",
    });
    return;
  }

  if (!ownsSlot && staff && slotOpen(row, slot)) {
    await interaction.reply({
      flags: MessageFlags.Ephemeral,
      content: "That slot is already open.",
    });
    return;
  }

  const now = new Date().toISOString();
  const update = slotUnclaimUpdate(row, slot, now);
  const supabase = createBotSupabase();

  let query = supabase
    .from("media_assignments")
    .update(update)
    .eq("id", assignmentId);

  if (slot === "streamer") {
    query = query.eq(
      "streamer_claimed_by_discord_id",
      row.streamer_claimed_by_discord_id,
    );
  } else {
    query = query.eq(
      "commentator_claimed_by_discord_id",
      row.commentator_claimed_by_discord_id,
    );
  }

  const { data: updated, error: updErr } = await query.select("*").maybeSingle();

  if (updErr || !updated) {
    await interaction.reply({
      flags: MessageFlags.Ephemeral,
      content: "Could not release that slot.",
    });
    return;
  }

  const openRow = updated as MediaAssignmentRow;
  const robloxMatchId = await fetchRobloxMatchIdForAssignment(openRow.match_id);

  await interaction.deferUpdate();
  await editAssignmentMessage(interaction.client, openRow, {
    robloxMatchId,
  });

  const slotLabel = slotRoleLabel(slot).toLowerCase();
  try {
    await interaction.followUp({
      flags: MessageFlags.Ephemeral,
      content: staff && !ownsSlot
        ? `Released **${slotLabel}** on \`${assignmentId.slice(0, 8)}…\` (staff action).`
        : `You released your **${slotLabel}** slot — it is open for others.`,
    });
  } catch {
    /* ignore */
  }
}

export async function handleMediaMyGamesCommand(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  if (!ensureMediaGuild(interaction)) return;
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const member = await fetchGuildMember(interaction);
  const hasMediaRole =
    memberHasSlotRole(member, "streamer") ||
    memberHasSlotRole(member, "commentator") ||
    member.roles.cache.has(mediaStaffRoleId());

  if (!hasMediaRole) {
    await interaction.editReply({
      content:
        "You need the **Streamer** or **Commentator** role to view media assignments.",
    });
    return;
  }

  const supabase = createBotSupabase();
  const userId = interaction.user.id;
  const { data, error } = await supabase
    .from("media_assignments")
    .select("*")
    .or(
      `streamer_claimed_by_discord_id.eq.${userId},commentator_claimed_by_discord_id.eq.${userId}`,
    )
    .in("status", ["open", "claimed"])
    .order("created_at", { ascending: true })
    .limit(20);

  if (error) {
    console.error("[media] my games:", error);
    await interaction.editReply({ content: "Could not load your assignments." });
    return;
  }

  const rows = (data ?? []) as MediaAssignmentRow[];
  if (rows.length === 0) {
    await interaction.editReply({ content: "You have no claimed fixtures right now." });
    return;
  }

  const lines = rows.map((r) => {
    const roles: string[] = [];
    if (userOwnsSlot(r, userId, "streamer")) roles.push("Streamer");
    if (userOwnsSlot(r, userId, "commentator")) roles.push("Commentator");
    const roleText = roles.length > 0 ? roles.join(" · ") : "Media";
    const gw = r.game_week_label ? ` (${r.game_week_label})` : "";
    const kick = r.kickoff_label ? ` · ${r.kickoff_label.split("\n")[0]}` : "";
    return `• S${r.season} **${r.competition}**${gw}: **${r.home_team_name}** vs **${r.away_team_name}** · ${roleText}${kick}`;
  });

  await interaction.editReply({
    content: ["**Your upcoming fixtures:**", ...lines].join("\n").slice(0, 2000),
  });
}
