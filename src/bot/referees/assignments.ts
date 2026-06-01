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

import { env } from "@/bot/config";
import {
  isRefereeGuild,
  refereeAssignmentsChannelId,
  refereeRoleId,
  refereeStaffRoleId,
} from "@/bot/referees/config";
import {
  fetchExistingAssignmentMatchIds,
  fetchNextMatchweekBundle,
  type RefMatchweekBundle,
  type RefMatchweekMatch,
} from "@/bot/referees/matchweek";
import {
  assignmentBothSlotsFilled,
  assignmentStatusFromSlots,
  findRefereeByDiscordId,
  refereeDisplayName,
  syncMatchRefereeFromAssignment,
  type RefereeAssignmentRow,
  type RefereeRow,
} from "@/bot/referees/queries";
import { createBotSupabase } from "@/bot/stats-queries";
import {
  REFEREE_ASSIGNMENT_CLAIM_PREFIX,
  REFEREE_SLOT_CLAIM_LINES,
  REFEREE_SLOT_CLAIM_MAIN,
  REFEREE_SLOT_UNCLAIM_LINES,
  REFEREE_SLOT_UNCLAIM_MAIN,
  type RefereeAssignmentSlot,
} from "@/lib/referees/discord-constants";
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

function ensureRefereeGuild(interaction: {
  guildId: string | null;
  reply: (opts: object) => Promise<unknown>;
}): boolean {
  if (!isRefereeGuild(interaction.guildId)) {
    void interaction.reply({
      flags: MessageFlags.Ephemeral,
      content: "This command is only available in the VF Referee server.",
    });
    return false;
  }
  return true;
}

function isRefereeStaff(member: GuildMember): boolean {
  if (
    member.permissions.has(PermissionFlagsBits.ManageRoles) ||
    member.permissions.has(PermissionFlagsBits.ManageGuild)
  ) {
    return true;
  }
  const staffRole = refereeStaffRoleId();
  return Boolean(staffRole && member.roles.cache.has(staffRole));
}

function canClaimAssignment(member: GuildMember): boolean {
  return member.roles.cache.has(refereeRoleId());
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

function buildKickoffDisplayFromIso(iso: string): string {
  const dual = formatDualTimezoneKickoffTime(iso);
  const ts = kickoffUnix(iso);
  if (ts == null) return dual;
  return `${dual}\n<t:${ts}:f> · <t:${ts}:R>`;
}

function buildKickoffFieldValue(
  kickoffLabel: string | null | undefined,
  scheduledAtIso?: string | null,
): string | null {
  if (scheduledAtIso?.trim()) {
    return buildKickoffDisplayFromIso(scheduledAtIso);
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
  row: RefereeAssignmentRow,
  slot: RefereeAssignmentSlot,
): string | null {
  if (slot === "main") {
    return row.main_claimed_by_discord_id ?? row.claimed_by_discord_id;
  }
  return row.linesman_claimed_by_discord_id;
}

function slotOpen(row: RefereeAssignmentRow, slot: RefereeAssignmentSlot): boolean {
  return !slotDiscordId(row, slot)?.trim();
}

function userOwnsSlot(
  row: RefereeAssignmentRow,
  userId: string,
  slot: RefereeAssignmentSlot,
): boolean {
  return slotDiscordId(row, slot) === userId;
}

function userOwnedSlot(
  row: RefereeAssignmentRow,
  userId: string,
): RefereeAssignmentSlot | null {
  if (userOwnsSlot(row, userId, "main")) return "main";
  if (userOwnsSlot(row, userId, "linesman")) return "linesman";
  return null;
}

function formatSlotValue(
  discordId: string | null | undefined,
  displayLabel?: string,
): string {
  if (!discordId?.trim()) return "*Open*";
  if (displayLabel?.trim()) {
    return `${displayLabel.trim()} (<@${discordId}>)`;
  }
  return `<@${discordId}>`;
}

function buildAssignmentEmbed(
  row: RefereeAssignmentRow,
  options?: {
    robloxMatchId?: string | null;
    scheduledAtIso?: string | null;
    mainLabel?: string;
    linesLabel?: string;
  },
): EmbedBuilder {
  const bothFilled = assignmentBothSlotsFilled(row);
  const embed = new EmbedBuilder()
    .setColor(bothFilled ? COLOR_FULL : COLOR_OPEN)
    .setTitle(
      bothFilled ? "Fixture · fully assigned" : "Fixture · open for officials",
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
        value: `**${row.home_team_name}** vs **${row.away_team_name}**`,
        inline: false,
      },
      {
        name: "Main referee",
        value: formatSlotValue(
          slotDiscordId(row, "main"),
          options?.mainLabel,
        ),
        inline: true,
      },
      {
        name: "Linesman",
        value: formatSlotValue(
          slotDiscordId(row, "linesman"),
          options?.linesLabel,
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
  row: RefereeAssignmentRow,
  viewerDiscordId: string | null,
): ActionRowBuilder<ButtonBuilder>[] {
  const buttons: ButtonBuilder[] = [];
  const ownsMain = viewerDiscordId
    ? userOwnsSlot(row, viewerDiscordId, "main")
    : false;
  const ownsLines = viewerDiscordId
    ? userOwnsSlot(row, viewerDiscordId, "linesman")
    : false;

  if (ownsMain) {
    buttons.push(
      new ButtonBuilder()
        .setCustomId(`${REFEREE_SLOT_UNCLAIM_MAIN}${row.id}`)
        .setLabel("Unclaim main ref")
        .setStyle(ButtonStyle.Danger),
    );
  } else if (slotOpen(row, "main") && !ownsLines) {
    buttons.push(
      new ButtonBuilder()
        .setCustomId(`${REFEREE_SLOT_CLAIM_MAIN}${row.id}`)
        .setLabel("Claim main ref")
        .setStyle(ButtonStyle.Success),
    );
  }

  if (ownsLines) {
    buttons.push(
      new ButtonBuilder()
        .setCustomId(`${REFEREE_SLOT_UNCLAIM_LINES}${row.id}`)
        .setLabel("Unclaim linesman")
        .setStyle(ButtonStyle.Danger),
    );
  } else if (slotOpen(row, "linesman") && !ownsMain) {
    buttons.push(
      new ButtonBuilder()
        .setCustomId(`${REFEREE_SLOT_CLAIM_LINES}${row.id}`)
        .setLabel("Claim linesman")
        .setStyle(ButtonStyle.Success),
    );
  }

  if (buttons.length === 0) return [];
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
    console.error("[referee] fetch roblox_match_id:", error);
    return null;
  }
  return (data as { roblox_match_id?: string | null } | null)?.roblox_match_id ?? null;
}

async function editAssignmentMessage(
  client: Client,
  row: RefereeAssignmentRow,
  viewerDiscordId: string | null,
  options?: {
    robloxMatchId?: string | null;
    scheduledAtIso?: string | null;
    mainLabel?: string;
    linesLabel?: string;
  },
): Promise<void> {
  if (!row.channel_id || !row.message_id) return;
  try {
    const ch = await client.channels.fetch(row.channel_id);
    if (!ch?.isTextBased()) return;
    const msg = await ch.messages.fetch(row.message_id);
    await msg.edit({
      embeds: [buildAssignmentEmbed(row, options)],
      components: buildAssignmentComponents(row, viewerDiscordId),
    });
  } catch (e) {
    console.error("[referee] assignment message edit:", e);
  }
}

async function requireActiveReferee(
  interaction: ButtonInteraction,
): Promise<RefereeRow | null> {
  const member = await fetchGuildMember(interaction);
  if (!canClaimAssignment(member)) {
    await interaction.reply({
      flags: MessageFlags.Ephemeral,
      content: "You need the **Referee** role to claim fixtures.",
    });
    return null;
  }

  const referee = await findRefereeByDiscordId(interaction.user.id);
  if (!referee || referee.status !== "active") {
    await interaction.reply({
      flags: MessageFlags.Ephemeral,
      content:
        "Your referee profile must be **active** before you can claim fixtures.",
    });
    return null;
  }

  return referee;
}

async function loadAssignment(
  assignmentId: string,
): Promise<RefereeAssignmentRow | null> {
  const supabase = createBotSupabase();
  const { data, error } = await supabase
    .from("referee_assignments")
    .select("*")
    .eq("id", assignmentId)
    .maybeSingle();
  if (error || !data) return null;
  return data as RefereeAssignmentRow;
}

function slotClaimUpdate(
  row: RefereeAssignmentRow,
  slot: RefereeAssignmentSlot,
  referee: RefereeRow,
  discordId: string,
  now: string,
): Record<string, unknown> {
  const next: RefereeAssignmentRow = { ...row };
  if (slot === "main") {
    next.main_referee_id = referee.id;
    next.main_claimed_by_discord_id = discordId;
    next.main_claimed_at = now;
    next.referee_id = referee.id;
    next.claimed_by_discord_id = discordId;
    next.claimed_at = now;
  } else {
    next.linesman_referee_id = referee.id;
    next.linesman_claimed_by_discord_id = discordId;
    next.linesman_claimed_at = now;
  }
  next.status = assignmentStatusFromSlots(next);
  next.updated_at = now;

  const update: Record<string, unknown> = {
    status: next.status,
    updated_at: now,
  };
  if (slot === "main") {
    update.main_referee_id = referee.id;
    update.main_claimed_by_discord_id = discordId;
    update.main_claimed_at = now;
    update.referee_id = referee.id;
    update.claimed_by_discord_id = discordId;
    update.claimed_at = now;
  } else {
    update.linesman_referee_id = referee.id;
    update.linesman_claimed_by_discord_id = discordId;
    update.linesman_claimed_at = now;
  }
  return update;
}

function slotUnclaimUpdate(
  row: RefereeAssignmentRow,
  slot: RefereeAssignmentSlot,
  now: string,
): Record<string, unknown> {
  const next: RefereeAssignmentRow = { ...row };
  if (slot === "main") {
    next.main_referee_id = null;
    next.main_claimed_by_discord_id = null;
    next.main_claimed_at = null;
    next.referee_id = null;
    next.claimed_by_discord_id = null;
    next.claimed_at = null;
  } else {
    next.linesman_referee_id = null;
    next.linesman_claimed_by_discord_id = null;
    next.linesman_claimed_at = null;
  }
  next.status = assignmentStatusFromSlots(next);
  next.updated_at = now;

  const update: Record<string, unknown> = {
    status: next.status,
    updated_at: now,
  };
  if (slot === "main") {
    update.main_referee_id = null;
    update.main_claimed_by_discord_id = null;
    update.main_claimed_at = null;
    update.referee_id = null;
    update.claimed_by_discord_id = null;
    update.claimed_at = null;
  } else {
    update.linesman_referee_id = null;
    update.linesman_claimed_by_discord_id = null;
    update.linesman_claimed_at = null;
  }
  return update;
}

async function postAssignmentRecord(input: {
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
  kickoffLabel: string | null;
  matchId: string | null;
  robloxMatchId: string | null;
  scheduledAtIso?: string | null;
}): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const assignmentId = randomUUID();
  const supabase = createBotSupabase();
  const now = new Date().toISOString();

  const { error: insErr } = await supabase.from("referee_assignments").insert({
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
    console.error("[referee] assignment insert:", insErr);
    return {
      ok: false,
      error: "Could not create assignment in the database. Apply the latest migration.",
    };
  }

  const row: RefereeAssignmentRow = {
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
    referee_id: null,
    claimed_by_discord_id: null,
    claimed_at: null,
    main_referee_id: null,
    main_claimed_by_discord_id: null,
    main_claimed_at: null,
    linesman_referee_id: null,
    linesman_claimed_by_discord_id: null,
    linesman_claimed_at: null,
    match_id: input.matchId,
    created_at: now,
    updated_at: now,
  };

  let msg;
  try {
    msg = await input.channel.send({
      content: "New fixture available for referees:",
      embeds: [
        buildAssignmentEmbed(row, {
          robloxMatchId: input.robloxMatchId,
          scheduledAtIso: input.scheduledAtIso,
        }),
      ],
      components: buildAssignmentComponents(row, null),
    });
  } catch (e) {
    console.error("[referee] assignment channel send:", e);
    await supabase.from("referee_assignments").delete().eq("id", assignmentId);
    return {
      ok: false,
      error: "Could not post to the assignments channel (check bot permissions).",
    };
  }

  await supabase
    .from("referee_assignments")
    .update({
      channel_id: input.channel.id,
      message_id: msg.id,
      updated_at: now,
    })
    .eq("id", assignmentId);

  return { ok: true, url: msg.url };
}

export async function handleRefFixturesCommand(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  if (!ensureRefereeGuild(interaction)) return;
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const member = await fetchGuildMember(interaction);
  if (!isRefereeStaff(member)) {
    await interaction.editReply({
      content: "Staff only — you need **Manage Roles** or the referee staff role.",
    });
    return;
  }

  const channelId = refereeAssignmentsChannelId() ?? interaction.channelId;
  const channel = await resolveSendableChannel(interaction.client, channelId);
  if (!channel) {
    await interaction.editReply({
      content:
        "Could not reach the assignments channel. Set `DISCORD_REFEREE_ASSIGNMENTS_CHANNEL_ID` or run this in a channel the bot can post to.",
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
    console.error("[referee] fetch matchweek bundle:", e);
    await interaction.editReply({
      content: "Could not load the next matchday from the database.",
    });
    return;
  }

  const matchIds = bundle.matches.map((m) => m.id);
  let existingIds: Set<string>;
  try {
    existingIds = await fetchExistingAssignmentMatchIds(
      supabase,
      interaction.guild!.id,
      matchIds,
    );
  } catch (e) {
    console.error("[referee] fetch existing assignments:", e);
    await interaction.editReply({
      content: "Could not check which fixtures were already posted.",
    });
    return;
  }

  const toPost = bundle.matches.filter((m) => !existingIds.has(m.id));
  if (toPost.length === 0) {
    await interaction.editReply({
      content: `All **${bundle.label}** fixtures are already posted (${bundle.competition}).`,
    });
    return;
  }

  const postedUrls: string[] = [];
  const failures: string[] = [];

  await channel.send({
    embeds: [
      new EmbedBuilder()
        .setColor(COLOR_OPEN)
        .setTitle(`${bundle.label} · ${bundle.competition}`)
        .setDescription(
          `Season **${bundle.season}** — claim **Main ref** or **Linesman** on each fixture below.`,
        )
        .setFooter({ text: `Posted by ${interaction.user.tag}` })
        .setTimestamp(),
    ],
  });

  for (let i = 0; i < toPost.length; i++) {
    const match = toPost[i]!;
    const kickoffLabel = buildKickoffDisplayFromIso(match.scheduled_at);
    const result = await postAssignmentRecord({
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

  const lines = [
    `Posted **${postedUrls.length}** fixture(s) for **${bundle.label}** (${bundle.competition}).`,
  ];
  if (existingIds.size > 0) {
    lines.push(`Skipped **${existingIds.size}** already posted.`);
  }
  if (failures.length > 0) {
    lines.push("", "**Failures:**", ...failures.slice(0, 8));
  }

  await interaction.editReply({
    content: lines.join("\n").slice(0, 2000),
  });
}

export async function handleRefAssignmentClaimButton(
  interaction: ButtonInteraction,
  assignmentIdRaw: string,
): Promise<void> {
  await handleRefAssignmentSlotButton(
    interaction,
    "claim",
    "main",
    assignmentIdRaw.trim(),
  );
}

export async function handleRefAssignmentSlotButton(
  interaction: ButtonInteraction,
  action: "claim" | "unclaim",
  slot: RefereeAssignmentSlot,
  assignmentIdRaw: string,
): Promise<void> {
  if (!ensureRefereeGuild(interaction)) return;

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
  slot: RefereeAssignmentSlot,
  assignmentId: string,
): Promise<void> {
  const referee = await requireActiveReferee(interaction);
  if (!referee) return;

  const row = await loadAssignment(assignmentId);
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

  const otherSlot: RefereeAssignmentSlot = slot === "main" ? "linesman" : "main";
  if (userOwnsSlot(row, interaction.user.id, otherSlot)) {
    await interaction.reply({
      flags: MessageFlags.Ephemeral,
      content: "You cannot claim both the main referee and linesman slots on the same fixture.",
    });
    return;
  }

  const now = new Date().toISOString();
  const update = slotClaimUpdate(row, slot, referee, interaction.user.id, now);
  const supabase = createBotSupabase();

  let query = supabase
    .from("referee_assignments")
    .update(update)
    .eq("id", assignmentId);

  if (slot === "main") {
    query = query.is("main_claimed_by_discord_id", null);
  } else {
    query = query.is("linesman_claimed_by_discord_id", null);
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

  const claimedRow = updated as RefereeAssignmentRow;
  const label = refereeDisplayName(referee);
  const robloxMatchId = await fetchRobloxMatchIdForAssignment(claimedRow.match_id);

  if (slot === "main") {
    await syncMatchRefereeFromAssignment({
      matchId: claimedRow.match_id,
      season: claimedRow.season,
      competition: claimedRow.competition,
      homeTeamName: claimedRow.home_team_name,
      awayTeamName: claimedRow.away_team_name,
      refereeLabel: label,
    });
  }

  await interaction.deferUpdate();
  await editAssignmentMessage(interaction.client, claimedRow, interaction.user.id, {
    robloxMatchId,
    mainLabel: slot === "main" ? label : undefined,
    linesLabel: slot === "linesman" ? label : undefined,
  });

  const slotLabel = slot === "main" ? "main referee" : "linesman";
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
  slot: RefereeAssignmentSlot,
  assignmentId: string,
): Promise<void> {
  const member = await fetchGuildMember(interaction);
  const row = await loadAssignment(assignmentId);
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

  const staff = isRefereeStaff(member);
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
    .from("referee_assignments")
    .update(update)
    .eq("id", assignmentId);

  if (slot === "main") {
    query = query.eq("main_claimed_by_discord_id", row.main_claimed_by_discord_id);
  } else {
    query = query.eq(
      "linesman_claimed_by_discord_id",
      row.linesman_claimed_by_discord_id,
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

  const openRow = updated as RefereeAssignmentRow;
  const robloxMatchId = await fetchRobloxMatchIdForAssignment(openRow.match_id);

  await interaction.deferUpdate();
  await editAssignmentMessage(interaction.client, openRow, interaction.user.id, {
    robloxMatchId,
  });

  const slotLabel = slot === "main" ? "main referee" : "linesman";
  try {
    await interaction.followUp({
      flags: MessageFlags.Ephemeral,
      content: staff && !ownsSlot
        ? `Released **${slotLabel}** on \`${assignmentId.slice(0, 8)}…\` (staff action).`
        : `You released your **${slotLabel}** slot — it is open for other referees.`,
    });
  } catch {
    /* ignore */
  }
}

export async function handleRefMyGamesCommand(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  if (!ensureRefereeGuild(interaction)) return;
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const referee = await findRefereeByDiscordId(interaction.user.id);
  if (!referee || referee.status !== "active") {
    await interaction.editReply({
      content: "You need an **active** referee profile to view assignments.",
    });
    return;
  }

  const supabase = createBotSupabase();
  const userId = interaction.user.id;
  const { data, error } = await supabase
    .from("referee_assignments")
    .select("*")
    .or(
      `main_claimed_by_discord_id.eq.${userId},linesman_claimed_by_discord_id.eq.${userId},claimed_by_discord_id.eq.${userId}`,
    )
    .in("status", ["open", "claimed"])
    .order("created_at", { ascending: true })
    .limit(20);

  if (error) {
    console.error("[referee] my games:", error);
    await interaction.editReply({ content: "Could not load your assignments." });
    return;
  }

  const rows = (data ?? []) as RefereeAssignmentRow[];
  if (rows.length === 0) {
    await interaction.editReply({ content: "You have no claimed fixtures right now." });
    return;
  }

  const lines = rows.map((r) => {
    const roles: string[] = [];
    if (userOwnsSlot(r, userId, "main")) roles.push("Main ref");
    if (userOwnsSlot(r, userId, "linesman")) roles.push("Linesman");
    const roleText = roles.length > 0 ? roles.join(" · ") : "Referee";
    const gw = r.game_week_label ? ` (${r.game_week_label})` : "";
    const kick = r.kickoff_label ? ` · ${r.kickoff_label.split("\n")[0]}` : "";
    return `• S${r.season} **${r.competition}**${gw}: **${r.home_team_name}** vs **${r.away_team_name}** · ${roleText}${kick}`;
  });

  await interaction.editReply({
    content: ["**Your upcoming fixtures:**", ...lines].join("\n").slice(0, 2000),
  });
}
