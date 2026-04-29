import {
  ComponentType,
  EmbedBuilder,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
  type GuildBasedChannel,
  type GuildMember,
  type GuildTextBasedChannel,
} from "discord.js";

import { env } from "@/bot/config";
import {
  APPROVE_BUTTON_ID_PREFIX,
  DENY_BUTTON_ID_PREFIX,
} from "@/bot/sync";

export const slashCommandDefinitions = [
  new SlashCommandBuilder()
    .setName("backlog")
    .setDescription(
      "Show every pending whitelist request waiting on staff approval",
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
    .toJSON(),

  new SlashCommandBuilder()
    .setName("kick")
    .setDescription("Kick a user from the server")
    .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers)
    .addUserOption((opt) =>
      opt
        .setName("user")
        .setDescription("User to kick")
        .setRequired(true),
    )
    .addStringOption((opt) =>
      opt
        .setName("reason")
        .setDescription("Reason for the kick")
        .setRequired(false),
    )
    .toJSON(),

  new SlashCommandBuilder()
    .setName("ban")
    .setDescription("Ban a user from the server")
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
    .addUserOption((opt) =>
      opt
        .setName("user")
        .setDescription("User to ban")
        .setRequired(true),
    )
    .addStringOption((opt) =>
      opt
        .setName("reason")
        .setDescription("Reason for the ban")
        .setRequired(false),
    )
    .addIntegerOption((opt) =>
      opt
        .setName("delete_days")
        .setDescription("Days of message history to delete (0-7)")
        .setMinValue(0)
        .setMaxValue(7)
        .setRequired(false),
    )
    .toJSON(),
];

export async function handleSlashCommand(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  switch (interaction.commandName) {
    case "backlog":
      await handleBacklog(interaction);
      return;
    case "kick":
      await handleKick(interaction);
      return;
    case "ban":
      await handleBan(interaction);
      return;
    default:
      await interaction.reply({
        flags: MessageFlags.Ephemeral,
        content: "Unknown command.",
      });
  }
}

async function handleBacklog(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  if (!interaction.guild) {
    await interaction.reply({
      flags: MessageFlags.Ephemeral,
      content: "Run this command inside the server.",
    });
    return;
  }

  if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageRoles)) {
    await interaction.reply({
      flags: MessageFlags.Ephemeral,
      content: "You need the Manage Roles permission to use /backlog.",
    });
    return;
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const members = await interaction.guild.members.fetch();

  const pending = Array.from(
    members
      .filter(
        (member) =>
          member.roles.cache.has(env.DISCORD_ROVER_VERIFIED_ROLE_ID) &&
          !member.roles.cache.has(env.DISCORD_APPROVED_ROLE_ID),
      )
      .values(),
  ).sort((a, b) => (a.joinedTimestamp ?? 0) - (b.joinedTimestamp ?? 0));

  if (pending.length === 0) {
    const embed = new EmbedBuilder()
      .setColor(0x10b981)
      .setTitle("✅ Backlog")
      .setDescription("No pending whitelist requests. All clear.");
    await interaction.editReply({ embeds: [embed] });
    return;
  }

  const cardLinks = await collectReviewCardLinks(interaction);

  const lines = pending.map((member, idx) => {
    const nick = member.nickname ? ` · nick \`${member.nickname}\`` : "";
    const joined = member.joinedTimestamp
      ? ` · joined <t:${Math.floor(member.joinedTimestamp / 1000)}:R>`
      : "";
    const cardUrl = cardLinks.get(member.id);
    const cardLink = cardUrl ? ` · [📩 review card](${cardUrl})` : "";
    return `**${idx + 1}.** ${member} (\`${member.user.username}\`)${nick}${joined}${cardLink}`;
  });

  const visible = lines.slice(0, 25).join("\n");
  const overflow =
    pending.length > 25
      ? `\n\n…and **${pending.length - 25}** more.`
      : "";

  const embed = new EmbedBuilder()
    .setColor(0x083696)
    .setTitle(`📋 Backlog · ${pending.length} pending`)
    .setDescription(`${visible}${overflow}`)
    .setFooter({
      text: "Tap a review card link to approve or deny that player.",
    })
    .setTimestamp(new Date());

  await interaction.editReply({ embeds: [embed] });
}

async function handleKick(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  if (!interaction.guild) {
    await interaction.reply({
      flags: MessageFlags.Ephemeral,
      content: "Run this command inside the server.",
    });
    return;
  }
  if (!interaction.memberPermissions?.has(PermissionFlagsBits.KickMembers)) {
    await interaction.reply({
      flags: MessageFlags.Ephemeral,
      content: "You need the Kick Members permission to use /kick.",
    });
    return;
  }

  const user = interaction.options.getUser("user", true);
  const reason =
    interaction.options.getString("reason") ?? "No reason provided";

  if (user.id === interaction.user.id) {
    await interaction.reply({
      flags: MessageFlags.Ephemeral,
      content: "You can't kick yourself.",
    });
    return;
  }
  if (interaction.client.user && user.id === interaction.client.user.id) {
    await interaction.reply({
      flags: MessageFlags.Ephemeral,
      content: "I can't kick myself, no.",
    });
    return;
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  let target: GuildMember | null = null;
  try {
    target = await interaction.guild.members.fetch(user.id);
  } catch {
    target = null;
  }
  if (!target) {
    await interaction.editReply({
      content: `**${user.tag}** isn't in the server.`,
    });
    return;
  }
  if (!target.kickable) {
    await interaction.editReply({
      content: `Can't kick **${user.tag}** — they're above the bot in the role hierarchy or are the server owner.`,
    });
    return;
  }

  let dmDelivered = true;
  try {
    const dm = new EmbedBuilder()
      .setColor(0xef4444)
      .setTitle("👢 You were kicked from VFL")
      .setDescription(`**Reason**\n${reason}`)
      .setFooter({ text: "VFL Bot" })
      .setTimestamp(new Date());
    await target.send({ embeds: [dm] });
  } catch {
    dmDelivered = false;
  }

  try {
    await target.kick(`Kicked by ${interaction.user.tag}: ${reason}`);
  } catch (error) {
    const msg = error instanceof Error ? error.message : "unknown error";
    await interaction.editReply({
      content: `Failed to kick **${user.tag}**: ${msg}`,
    });
    return;
  }

  const result = new EmbedBuilder()
    .setColor(0xef4444)
    .setTitle("👢 Kicked")
    .setDescription(`**${user.tag}** has been kicked from the server.`)
    .addFields(
      { name: "Reason", value: reason, inline: false },
      {
        name: "DM",
        value: dmDelivered ? "Delivered" : "Not delivered (user blocks DMs)",
        inline: false,
      },
    )
    .setFooter({ text: `Kicked by ${interaction.user.tag}` })
    .setTimestamp(new Date());

  await interaction.editReply({ embeds: [result] });
}

async function handleBan(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  if (!interaction.guild) {
    await interaction.reply({
      flags: MessageFlags.Ephemeral,
      content: "Run this command inside the server.",
    });
    return;
  }
  if (!interaction.memberPermissions?.has(PermissionFlagsBits.BanMembers)) {
    await interaction.reply({
      flags: MessageFlags.Ephemeral,
      content: "You need the Ban Members permission to use /ban.",
    });
    return;
  }

  const user = interaction.options.getUser("user", true);
  const reason =
    interaction.options.getString("reason") ?? "No reason provided";
  const deleteDays = interaction.options.getInteger("delete_days") ?? 0;

  if (user.id === interaction.user.id) {
    await interaction.reply({
      flags: MessageFlags.Ephemeral,
      content: "You can't ban yourself.",
    });
    return;
  }
  if (interaction.client.user && user.id === interaction.client.user.id) {
    await interaction.reply({
      flags: MessageFlags.Ephemeral,
      content: "I can't ban myself.",
    });
    return;
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  let target: GuildMember | null = null;
  try {
    target = await interaction.guild.members.fetch(user.id);
  } catch {
    target = null;
  }

  if (target && !target.bannable) {
    await interaction.editReply({
      content: `Can't ban **${user.tag}** — they're above the bot in the role hierarchy or are the server owner.`,
    });
    return;
  }

  let dmDelivered = true;
  if (target) {
    try {
      const dm = new EmbedBuilder()
        .setColor(0x991b1b)
        .setTitle("🔨 You were banned from VFL")
        .setDescription(`**Reason**\n${reason}`)
        .setFooter({ text: "VFL Bot" })
        .setTimestamp(new Date());
      await target.send({ embeds: [dm] });
    } catch {
      dmDelivered = false;
    }
  } else {
    dmDelivered = false;
  }

  try {
    await interaction.guild.members.ban(user.id, {
      deleteMessageSeconds: deleteDays * 86400,
      reason: `Banned by ${interaction.user.tag}: ${reason}`,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "unknown error";
    await interaction.editReply({
      content: `Failed to ban **${user.tag}**: ${msg}`,
    });
    return;
  }

  const result = new EmbedBuilder()
    .setColor(0x991b1b)
    .setTitle("🔨 Banned")
    .setDescription(`**${user.tag}** has been banned from the server.`)
    .addFields(
      { name: "Reason", value: reason, inline: false },
      {
        name: "Messages deleted",
        value:
          deleteDays > 0
            ? `${deleteDays} day${deleteDays === 1 ? "" : "s"} of history`
            : "None",
        inline: true,
      },
      {
        name: "DM",
        value: target
          ? dmDelivered
            ? "Delivered"
            : "Not delivered (user blocks DMs)"
          : "Skipped (user not in server)",
        inline: true,
      },
    )
    .setFooter({ text: `Banned by ${interaction.user.tag}` })
    .setTimestamp(new Date());

  await interaction.editReply({ embeds: [result] });
}

async function collectReviewCardLinks(
  interaction: ChatInputCommandInteraction,
): Promise<Map<string, string>> {
  const links = new Map<string, string>();
  if (!interaction.guild) return links;

  let channel: GuildBasedChannel | null;
  try {
    channel = await interaction.guild.channels.fetch(
      env.DISCORD_STAFF_REVIEW_CHANNEL_ID,
    );
  } catch {
    return links;
  }

  if (!channel || !channel.isTextBased()) return links;

  let messages;
  try {
    messages = await (channel as GuildTextBasedChannel).messages.fetch({
      limit: 100,
    });
  } catch {
    return links;
  }

  // Messages come back newest first — first hit per memberId wins.
  for (const message of messages.values()) {
    for (const row of message.components ?? []) {
      if (row.type !== ComponentType.ActionRow) continue;
      for (const component of row.components) {
        if (component.type !== ComponentType.Button) continue;
        const customId = component.customId;
        if (!customId) continue;
        let memberId: string | null = null;
        if (customId.startsWith(APPROVE_BUTTON_ID_PREFIX)) {
          memberId = customId.slice(APPROVE_BUTTON_ID_PREFIX.length);
        } else if (customId.startsWith(DENY_BUTTON_ID_PREFIX)) {
          memberId = customId.slice(DENY_BUTTON_ID_PREFIX.length);
        }
        if (memberId && !links.has(memberId)) {
          links.set(memberId, message.url);
        }
      }
    }
  }

  return links;
}
