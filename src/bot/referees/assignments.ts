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
  type GuildMember,
  type GuildTextBasedChannel,
} from "discord.js";

import { REFEREE_ASSIGNMENT_CLAIM_PREFIX } from "@/lib/referees/discord-constants";
import {
  isRefereeGuild,
  refereeAssignmentsChannelId,
  refereeRoleId,
  refereeStaffRoleId,
} from "@/bot/referees/config";
import {
  findRefereeByDiscordId,
  refereeDisplayName,
  syncMatchRefereeFromAssignment,
  type RefereeAssignmentRow,
} from "@/bot/referees/queries";
import { createBotSupabase } from "@/bot/stats-queries";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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

async function resolveSendableChannel(
  client: ChatInputCommandInteraction["client"],
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

function buildOpenAssignmentEmbed(
  row: Pick<
    RefereeAssignmentRow,
    | "id"
    | "season"
    | "competition"
    | "game_week_label"
    | "home_team_name"
    | "away_team_name"
    | "kickoff_label"
  >,
): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setColor(0x6366f1)
    .setTitle("Fixture · open for referee")
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
    )
    .setFooter({ text: `Assignment ${row.id.slice(0, 8)}… · Click Claim` })
    .setTimestamp(new Date());

  if (row.kickoff_label?.trim()) {
    embed.addFields({
      name: "Kickoff",
      value: row.kickoff_label.trim(),
      inline: false,
    });
  }

  return embed;
}

function buildClaimedAssignmentEmbed(
  row: RefereeAssignmentRow,
  claimedDiscordId: string,
  refereeLabel: string,
): EmbedBuilder {
  return buildOpenAssignmentEmbed(row)
    .setColor(0x10b981)
    .setTitle("Fixture · referee assigned")
    .addFields({
      name: "Referee",
      value: `${refereeLabel} (<@${claimedDiscordId}>)`,
      inline: false,
    });
}

function buildClaimButton(assignmentId: string): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`${REFEREE_ASSIGNMENT_CLAIM_PREFIX}${assignmentId}`)
      .setLabel("Claim fixture")
      .setStyle(ButtonStyle.Success),
  );
}

export async function handleRefPostCommand(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  if (!ensureRefereeGuild(interaction)) return;
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  let member = interaction.member as GuildMember;
  try {
    if (interaction.guild) {
      member = await interaction.guild.members.fetch(interaction.user.id);
    }
  } catch {
    /* keep cached */
  }

  if (!isRefereeStaff(member)) {
    await interaction.editReply({
      content: "Staff only — you need **Manage Roles** or the referee staff role.",
    });
    return;
  }

  const season = interaction.options.getInteger("season", true);
  const competition = interaction.options.getString("competition", true).trim();
  const home = interaction.options.getString("home", true).trim();
  const away = interaction.options.getString("away", true).trim();
  const gameWeek = interaction.options.getString("game_week")?.trim() || null;
  const kickoff = interaction.options.getString("kickoff")?.trim() || null;
  const matchId = interaction.options.getString("match_id")?.trim() || null;

  if (!competition || !home || !away) {
    await interaction.editReply({ content: "Competition, home, and away are required." });
    return;
  }

  const assignmentId = randomUUID();
  const supabase = createBotSupabase();
  const now = new Date().toISOString();

  const { error: insErr } = await supabase.from("referee_assignments").insert({
    id: assignmentId,
    guild_id: interaction.guild!.id,
    season,
    competition,
    game_week_label: gameWeek,
    home_team_name: home,
    away_team_name: away,
    kickoff_label: kickoff,
    posted_by_discord_id: interaction.user.id,
    posted_by_discord_tag: interaction.user.tag,
    status: "open",
    match_id: matchId,
    created_at: now,
    updated_at: now,
  });

  if (insErr) {
    console.error("[referee] assignment insert:", insErr);
    await interaction.editReply({
      content:
        "Could not create assignment in the database. Apply the latest migration.",
    });
    return;
  }

  const channelId =
    refereeAssignmentsChannelId() ?? interaction.channelId;
  const channel = await resolveSendableChannel(interaction.client, channelId);
  if (!channel) {
    await supabase.from("referee_assignments").delete().eq("id", assignmentId);
    await interaction.editReply({
      content:
        "Could not reach the assignments channel. Set `DISCORD_REFEREE_ASSIGNMENTS_CHANNEL_ID` or run this in a channel the bot can post to.",
    });
    return;
  }

  const row: RefereeAssignmentRow = {
    id: assignmentId,
    guild_id: interaction.guild!.id,
    channel_id: null,
    message_id: null,
    season,
    competition,
    game_week_label: gameWeek,
    home_team_name: home,
    away_team_name: away,
    kickoff_label: kickoff,
    posted_by_discord_id: interaction.user.id,
    posted_by_discord_tag: interaction.user.tag,
    status: "open",
    referee_id: null,
    claimed_by_discord_id: null,
    claimed_at: null,
    match_id: matchId,
    created_at: now,
    updated_at: now,
  };

  let msg;
  try {
    msg = await channel.send({
      content: "New fixture available for referees:",
      embeds: [buildOpenAssignmentEmbed(row)],
      components: [buildClaimButton(assignmentId)],
    });
  } catch (e) {
    console.error("[referee] assignment channel send:", e);
    await supabase.from("referee_assignments").delete().eq("id", assignmentId);
    await interaction.editReply({
      content: "Could not post to the assignments channel (check bot permissions).",
    });
    return;
  }

  await supabase
    .from("referee_assignments")
    .update({ channel_id: channel.id, message_id: msg.id, updated_at: now })
    .eq("id", assignmentId);

  await interaction.editReply({
    content: `Fixture posted in ${channel}: ${msg.url}`,
  });
}

export async function handleRefAssignmentClaimButton(
  interaction: ButtonInteraction,
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

  let member = interaction.member as GuildMember;
  try {
    if (interaction.guild) {
      member = await interaction.guild.members.fetch(interaction.user.id);
    }
  } catch {
    /* keep cached */
  }

  if (!canClaimAssignment(member)) {
    await interaction.reply({
      flags: MessageFlags.Ephemeral,
      content: "You need the **Referee** role to claim fixtures.",
    });
    return;
  }

  const referee = await findRefereeByDiscordId(interaction.user.id);
  if (!referee || referee.status !== "active") {
    await interaction.reply({
      flags: MessageFlags.Ephemeral,
      content: "Your referee profile must be **active** before you can claim fixtures.",
    });
    return;
  }

  const supabase = createBotSupabase();
  const { data: existing, error: fetchErr } = await supabase
    .from("referee_assignments")
    .select("*")
    .eq("id", assignmentId)
    .maybeSingle();

  if (fetchErr || !existing) {
    await interaction.reply({
      flags: MessageFlags.Ephemeral,
      content: "That assignment could not be found.",
    });
    return;
  }

  const row = existing as RefereeAssignmentRow;
  if (row.status === "claimed") {
    const who = row.claimed_by_discord_id
      ? `<@${row.claimed_by_discord_id}>`
      : "another referee";
    await interaction.reply({
      flags: MessageFlags.Ephemeral,
      content: `This fixture was already claimed by ${who}.`,
    });
    return;
  }

  if (row.status !== "open") {
    await interaction.reply({
      flags: MessageFlags.Ephemeral,
      content: "This assignment is no longer available.",
    });
    return;
  }

  const claimedAt = new Date().toISOString();
  const { data: updated, error: updErr } = await supabase
    .from("referee_assignments")
    .update({
      status: "claimed",
      referee_id: referee.id,
      claimed_by_discord_id: interaction.user.id,
      claimed_at: claimedAt,
      updated_at: claimedAt,
    })
    .eq("id", assignmentId)
    .eq("status", "open")
    .select("*")
    .maybeSingle();

  if (updErr || !updated) {
    await interaction.reply({
      flags: MessageFlags.Ephemeral,
      content: updErr ? "Could not claim that fixture right now." : "Someone else just claimed it.",
    });
    return;
  }

  const claimedRow = updated as RefereeAssignmentRow;
  const label = refereeDisplayName(referee);

  await syncMatchRefereeFromAssignment({
    matchId: claimedRow.match_id,
    season: claimedRow.season,
    competition: claimedRow.competition,
    homeTeamName: claimedRow.home_team_name,
    awayTeamName: claimedRow.away_team_name,
    refereeLabel: label,
  });

  await interaction.deferUpdate();
  try {
    await interaction.message.edit({
      embeds: [
        buildClaimedAssignmentEmbed(
          claimedRow,
          interaction.user.id,
          label,
        ),
      ],
      components: [],
    });
  } catch (e) {
    console.error("[referee] claim message edit:", e);
  }

  try {
    await interaction.followUp({
      flags: MessageFlags.Ephemeral,
      content: `You claimed **${claimedRow.home_team_name}** vs **${claimedRow.away_team_name}**.`,
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
  const { data, error } = await supabase
    .from("referee_assignments")
    .select("*")
    .eq("referee_id", referee.id)
    .eq("status", "claimed")
    .order("claimed_at", { ascending: true })
    .limit(15);

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
    const gw = r.game_week_label ? ` (${r.game_week_label})` : "";
    const kick = r.kickoff_label ? ` · ${r.kickoff_label}` : "";
    return `• S${r.season} **${r.competition}**${gw}: **${r.home_team_name}** vs **${r.away_team_name}**${kick}`;
  });

  await interaction.editReply({
    content: ["**Your upcoming fixtures:**", ...lines].join("\n").slice(0, 2000),
  });
}

export async function handleRefUnclaimCommand(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  if (!ensureRefereeGuild(interaction)) return;
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  let member = interaction.member as GuildMember;
  try {
    if (interaction.guild) {
      member = await interaction.guild.members.fetch(interaction.user.id);
    }
  } catch {
    /* keep cached */
  }

  const assignmentId = interaction.options.getString("assignment_id", true).trim();
  if (!UUID_RE.test(assignmentId)) {
    await interaction.editReply({ content: "Invalid assignment id." });
    return;
  }

  const supabase = createBotSupabase();
  const { data: row, error: fetchErr } = await supabase
    .from("referee_assignments")
    .select("*")
    .eq("id", assignmentId)
    .maybeSingle();

  if (fetchErr || !row) {
    await interaction.editReply({ content: "Assignment not found." });
    return;
  }

  const assignment = row as RefereeAssignmentRow;
  const staff = isRefereeStaff(member);
  const isOwner = assignment.claimed_by_discord_id === interaction.user.id;

  if (!staff && !isOwner) {
    await interaction.editReply({
      content: "You can only unclaim your own assignments (staff can unclaim any).",
    });
    return;
  }

  if (assignment.status !== "claimed") {
    await interaction.editReply({
      content: "Only **claimed** assignments can be released.",
    });
    return;
  }

  const now = new Date().toISOString();
  const { data: updated, error: updErr } = await supabase
    .from("referee_assignments")
    .update({
      status: "open",
      referee_id: null,
      claimed_by_discord_id: null,
      claimed_at: null,
      updated_at: now,
    })
    .eq("id", assignmentId)
    .eq("status", "claimed")
    .select("*")
    .maybeSingle();

  if (updErr || !updated) {
    await interaction.editReply({ content: "Could not release that assignment." });
    return;
  }

  const openRow = updated as RefereeAssignmentRow;

  if (openRow.channel_id && openRow.message_id) {
    try {
      const ch = await interaction.client.channels.fetch(openRow.channel_id);
      if (ch?.isTextBased()) {
        const msg = await ch.messages.fetch(openRow.message_id);
        await msg.edit({
          embeds: [buildOpenAssignmentEmbed(openRow)],
          components: [buildClaimButton(openRow.id)],
        });
      }
    } catch (e) {
      console.error("[referee] unclaim message edit:", e);
    }
  }

  await interaction.editReply({
    content: staff && !isOwner
      ? `Released assignment \`${assignmentId.slice(0, 8)}…\` (staff action).`
      : "You released that fixture — it is open for other referees to claim.",
  });
}