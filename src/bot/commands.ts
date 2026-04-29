import {
  ComponentType,
  EmbedBuilder,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
  type GuildBasedChannel,
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
];

export async function handleSlashCommand(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  switch (interaction.commandName) {
    case "backlog":
      await handleBacklog(interaction);
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
