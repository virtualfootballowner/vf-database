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
} from "discord.js";

import {
  isRefereeGuild,
  refereeRoleId,
  refereeStaffRoleId,
} from "@/bot/referees/config";
import { env } from "@/bot/config";
import {
  approveReferee,
  denyReferee,
  findRefereeByDiscordId,
  listActiveReferees,
  countRefereeAssignments,
  refereeDisplayName,
} from "@/bot/referees/queries";

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

function ensureRefereeStaff(interaction: ButtonInteraction): boolean {
  const member = interaction.member as GuildMember;
  if (!isRefereeStaff(member)) {
    void interaction.reply({
      flags: MessageFlags.Ephemeral,
      content: "You need **Manage Roles** or the referee staff role to review applications.",
    });
    return false;
  }
  return true;
}

export async function handlePostVerifyRefCommand(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  if (!ensureRefereeGuild(interaction)) return;
  if (
    !interaction.channel?.isTextBased() ||
    !interaction.channel.isSendable()
  ) {
    await interaction.reply({
      flags: MessageFlags.Ephemeral,
      content: "Use this command in a sendable text channel.",
    });
    return;
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const member = interaction.member as GuildMember;
  if (!isRefereeStaff(member)) {
    await interaction.editReply({
      content: "You need **Manage Roles** or the referee staff role to post the verify card.",
    });
    return;
  }

  const verifyUrl = `${env.VFL_SITE_URL.replace(/\/$/, "")}/verify/referee`;
  const embed = new EmbedBuilder()
    .setColor(0x6366f1)
    .setTitle("Verify for VF Referees")
    .setDescription(
      [
        "We're looking for referees for league and tournament fixtures.",
        "",
        "**Click below** to link Discord + Roblox.",
        "Your nickname will be set to your Roblox username. Staff review every applicant before granting the Referee role.",
      ].join("\n"),
    )
    .setFooter({ text: "VF Referees" })
    .setTimestamp(new Date());

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setLabel("Verify")
      .setStyle(ButtonStyle.Link)
      .setURL(verifyUrl),
  );

  try {
    await interaction.channel.send({ embeds: [embed], components: [row] });
    await interaction.editReply({ content: "Posted referee verify card." });
  } catch (e) {
    console.error("[referee] postverify card:", e);
    await interaction.editReply({
      content: "Could not post the card (check Send Messages / Embed Links).",
    });
  }
}

export async function handleRefereeApproveButton(
  interaction: ButtonInteraction,
  targetDiscordId: string,
): Promise<void> {
  if (!ensureRefereeStaff(interaction)) return;
  await interaction.deferUpdate();

  const approve = await approveReferee({
    discordId: targetDiscordId,
    approvedByDiscordId: interaction.user.id,
  });
  if (!approve.ok || !approve.row) {
    await interaction.followUp({
      flags: MessageFlags.Ephemeral,
      content: approve.error ?? "Approve failed.",
    });
    return;
  }

  let memberNote = "";
  if (interaction.guild) {
    try {
      const member = await interaction.guild.members.fetch(targetDiscordId);
      const roleId = refereeRoleId();
      if (member.roles.cache.has(roleId)) {
        memberNote = " Already had the Referee role.";
      } else {
        await member.roles.add(
          roleId,
          `Referee approved by ${interaction.user.tag}`,
        );
        memberNote = " Referee role granted.";
      }
    } catch (e) {
      console.error("[referee] role add:", e);
      memberNote =
        " Could not grant role — check bot **Manage Roles** and hierarchy.";
    }
  }

  try {
    const u = await interaction.client.users.fetch(targetDiscordId);
    await u.send({
      content:
        "**VF Referees — approved.** You can claim fixtures from the assignments channel when staff post them.",
    });
  } catch {
    /* DMs closed */
  }

  const original = interaction.message.embeds[0];
  const builder = original
    ? EmbedBuilder.from(original)
    : new EmbedBuilder().setTitle("Referee verification");
  builder.setColor(0x10b981).addFields({
    name: "Approved",
    value: `By <@${interaction.user.id}> at <t:${Math.floor(Date.now() / 1000)}:F>${memberNote}`,
    inline: false,
  });

  await interaction.editReply({ embeds: [builder], components: [] });
}

export async function handleRefereeDenyButton(
  interaction: ButtonInteraction,
  targetDiscordId: string,
): Promise<void> {
  if (!ensureRefereeStaff(interaction)) return;
  await interaction.deferUpdate();

  const denied = await denyReferee({
    discordId: targetDiscordId,
    deniedByDiscordId: interaction.user.id,
  });
  if (!denied.ok) {
    await interaction.followUp({
      flags: MessageFlags.Ephemeral,
      content: denied.error ?? "Deny failed.",
    });
    return;
  }

  try {
    const u = await interaction.client.users.fetch(targetDiscordId);
    await u.send({
      content:
        "Thanks for verifying with **VF Referees**. We're not able to approve you right now.",
    });
  } catch {
    /* DMs closed */
  }

  const original = interaction.message.embeds[0];
  const builder = original
    ? EmbedBuilder.from(original)
    : new EmbedBuilder().setTitle("Referee verification");
  builder.setColor(0xef4444).addFields({
    name: "Denied",
    value: `By <@${interaction.user.id}>`,
    inline: false,
  });

  await interaction.editReply({ embeds: [builder], components: [] });
}

export async function handleRefProfileCommand(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  if (!ensureRefereeGuild(interaction)) return;
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const verifyUrl = `${env.VFL_SITE_URL.replace(/\/$/, "")}/verify/referee`;
  const row = await findRefereeByDiscordId(interaction.user.id);
  if (!row) {
    await interaction.editReply({
      content: `No referee profile found. Complete verify first: ${verifyUrl}`,
    });
    return;
  }

  const assignments =
    row.status === "active" ? await countRefereeAssignments(row.id) : 0;

  const embed = new EmbedBuilder()
    .setColor(row.status === "active" ? 0x10b981 : 0x6366f1)
    .setTitle("Your referee profile")
    .addFields(
      { name: "Status", value: row.status, inline: true },
      { name: "Tier", value: row.tier ?? "—", inline: true },
      {
        name: "Roblox",
        value: row.roblox_username ?? "—",
        inline: true,
      },
      {
        name: "Assignments (claimed/completed)",
        value: String(assignments),
        inline: true,
      },
    )
    .setTimestamp(new Date());

  if (row.approved_at) {
    embed.addFields({
      name: "Approved",
      value: `<t:${Math.floor(new Date(row.approved_at).getTime() / 1000)}:F>`,
      inline: false,
    });
  }

  await interaction.editReply({ embeds: [embed] });
}

export async function handleRefListCommand(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  if (!ensureRefereeGuild(interaction)) return;
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const member = interaction.member as GuildMember;
  if (!isRefereeStaff(member)) {
    await interaction.editReply({
      content: "Staff only — you need **Manage Roles** or the referee staff role.",
    });
    return;
  }

  const rows = await listActiveReferees(25);
  if (rows.length === 0) {
    await interaction.editReply({ content: "No active referees in the roster yet." });
    return;
  }

  const lines = rows.map((r, i) => {
    const name = refereeDisplayName(r);
    const tier = r.tier ? ` · ${r.tier}` : "";
    return `${i + 1}. **${name}** (<@${r.discord_id}>)${tier}`;
  });

  const embed = new EmbedBuilder()
    .setColor(0x6366f1)
    .setTitle(`Active referees (${rows.length})`)
    .setDescription(lines.join("\n").slice(0, 4000))
    .setTimestamp(new Date());

  await interaction.editReply({ embeds: [embed] });
}
