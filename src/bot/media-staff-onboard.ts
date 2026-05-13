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

import { env } from "@/bot/config";

function mediaStaffTargetGuildId(): string {
  return (
    process.env.DISCORD_MEDIA_GUILD_ID?.trim() ||
    env.DISCORD_CREATOR_VF_GUILD_ID?.trim() ||
    env.DISCORD_GUILD_ID
  );
}

function ensureManageRolesStaff(interaction: ButtonInteraction): boolean {
  if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageRoles)) {
    void interaction.reply({
      flags: MessageFlags.Ephemeral,
      content: "You need **Manage Roles** to review applications.",
    });
    return false;
  }
  return true;
}

export async function handleMediaStaffApproveButton(
  interaction: ButtonInteraction,
  targetDiscordId: string,
): Promise<void> {
  if (!ensureManageRolesStaff(interaction)) return;

  await interaction.deferUpdate();

  const guildId = mediaStaffTargetGuildId();
  const roleId = env.DISCORD_MEDIA_STAFF_ROLE_ID;

  let guild;
  try {
    guild = await interaction.client.guilds.fetch(guildId);
  } catch (e) {
    console.error("[media-staff] approve guild fetch:", e);
    await interaction.followUp({
      flags: MessageFlags.Ephemeral,
      content: "Could not load the VF Media server. Check bot membership and `DISCORD_MEDIA_GUILD_ID` / `DISCORD_CREATOR_VF_GUILD_ID`.",
    });
    return;
  }

  let member: GuildMember | null = null;
  try {
    member = await guild.members.fetch(targetDiscordId);
  } catch {
    member = null;
  }

  let memberNote = "";
  if (!member) {
    memberNote =
      " Applicant is **not in** the VF Media server — role could not be added. Ask them to join, then use Discord to add the role manually.";
  } else {
    try {
      if (member.roles.cache.has(roleId)) {
        memberNote = " They already had the media staff role.";
      } else {
        await member.roles.add(
          roleId,
          `Media staff approved by ${interaction.user.tag}`,
        );
      }
    } catch (e) {
      console.error("[media-staff] role add:", e);
      memberNote =
        " Could not add role — check bot **Manage Roles** and role hierarchy.";
    }
  }

  try {
    const u = await interaction.client.users.fetch(targetDiscordId);
    await u.send({
      content:
        "**VF Media — application approved.** Welcome to the media team. If your Discord role didn’t update automatically, ping staff (you may need to be in the VF Media server first).",
    });
  } catch {
    /* DMs closed */
  }

  const original = interaction.message.embeds[0];
  const builder = original
    ? EmbedBuilder.from(original)
    : new EmbedBuilder().setTitle("Media staff application");
  builder.setColor(0x10b981);
  const adminId = interaction.user.id;
  builder.addFields({
    name: "Approved",
    value: `By <@${adminId}> at <t:${Math.floor(Date.now() / 1000)}:F>${memberNote}`,
    inline: false,
  });

  await interaction.editReply({
    embeds: [builder],
    components: [],
  });
}

export async function handleMediaStaffRejectButton(
  interaction: ButtonInteraction,
  targetDiscordId: string,
): Promise<void> {
  if (!ensureManageRolesStaff(interaction)) return;

  await interaction.deferUpdate();

  try {
    const u = await interaction.client.users.fetch(targetDiscordId);
    await u.send({
      content:
        "Thanks for applying to **VF Media** staff. We’re not able to move forward with your application right now.",
    });
  } catch {
    /* ignore */
  }

  const original = interaction.message.embeds[0];
  const builder = original
    ? EmbedBuilder.from(original)
    : new EmbedBuilder().setTitle("Media staff application");
  builder.setColor(0xef4444);
  builder.addFields({
    name: "Rejected",
    value: `By <@${interaction.user.id}>`,
    inline: false,
  });

  await interaction.editReply({
    embeds: [builder],
    components: [],
  });

  await interaction.followUp({
    flags: MessageFlags.Ephemeral,
    content: "Rejected. Applicant was DM’d if their DMs are open.",
  });
}

export async function handlePostVerifyMediaStaffCard(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  if (
    !interaction.guild ||
    !interaction.channel?.isTextBased() ||
    !interaction.channel.isSendable()
  ) {
    await interaction.reply({
      flags: MessageFlags.Ephemeral,
      content: "Use this command in a sendable text channel inside the server.",
    });
    return;
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
    await interaction.editReply({
      content: "You need **Manage Server** to post the verification card.",
    });
    return;
  }

  const verifyUrl = `${env.VFL_SITE_URL.replace(/\/$/, "")}/verify/media-staff`;
  const embed = new EmbedBuilder()
    .setColor(0x6366f1)
    .setTitle("VF Media staff — verify & apply")
    .setDescription(
      [
        "**Click below** to sign in with Discord and Roblox (same as media verify: nickname + verified role).",
        "",
        "After that, you’ll fill out a **short application** (role type + work samples). Staff review it in the same channel as VF Create applications.",
      ].join("\n"),
    )
    .setFooter({ text: "VF Media · Staff onboarding" })
    .setTimestamp(new Date());

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setLabel("Start verify & application")
      .setStyle(ButtonStyle.Link)
      .setURL(verifyUrl),
  );

  try {
    await interaction.channel.send({ embeds: [embed], components: [row] });
    await interaction.editReply({ content: "Posted." });
  } catch (err) {
    console.error("/postverify-media-staff: failed to post card:", err);
    await interaction.editReply({
      content:
        "Could not post the card in this channel (check bot Send Messages / Embed Links).",
    });
  }
}
