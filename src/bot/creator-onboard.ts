import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonInteraction,
  ButtonStyle,
  EmbedBuilder,
  ModalBuilder,
  PermissionFlagsBits,
  SlashCommandBuilder,
  TextInputBuilder,
  TextInputStyle,
  type ChatInputCommandInteraction,
  type GuildMember,
  type GuildTextBasedChannel,
  type ModalSubmitInteraction,
} from "discord.js";

import { env } from "@/bot/config";
import { createBotSupabase } from "@/bot/stats-queries";
import {
  CREATOR_APPROVE_PREFIX,
  CREATOR_REJECT_MODAL_PREFIX,
  CREATOR_REJECT_PREFIX,
  CREATOR_START_APP_BUTTON,
} from "@/lib/creator-onboard/creator-discord-constants";

export const onboardMediaCommand = new SlashCommandBuilder()
  .setName("onboard-media")
  .setDescription(
    "Post the VF Creator Program onboarding card in this channel",
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .toJSON();

function vfGuildId(): string {
  return env.DISCORD_CREATOR_VF_GUILD_ID?.trim() || env.DISCORD_GUILD_ID;
}

function truncateNick(name: string, max = 32): string {
  const t = name.trim();
  if (t.length <= max) return t;
  return t.slice(0, max - 1) + "…";
}

export async function handleOnboardMediaCommand(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  if (!interaction.guild) {
    await interaction.reply({
      ephemeral: true,
      content: "Use this command inside a server text channel.",
    });
    return;
  }

  const channel = interaction.channel;
  if (!channel?.isTextBased()) {
    await interaction.reply({
      ephemeral: true,
      content: "Use this command inside a text channel.",
    });
    return;
  }

  const embed = new EmbedBuilder()
    .setColor(0x083696)
    .setTitle("VF Creator Program — Now onboarding")
    .setDescription(
      [
        "Want early access to **VF** and a shot at **Robux**-backed creator challenges?",
        "",
        "Click **Start application** — we’ll **DM you** a personal link (about **3 minutes** on your phone). If DMs are closed, you’ll get the link here instead.",
      ].join("\n"),
    )
    .setFooter({ text: "VF Creators" })
    .setTimestamp(new Date());

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(CREATOR_START_APP_BUTTON)
      .setLabel("Start application")
      .setStyle(ButtonStyle.Primary),
  );

  await interaction.reply({
    ephemeral: true,
    content: "Posted the creator card.",
  });

  await (channel as GuildTextBasedChannel).send({
    embeds: [embed],
    components: [row],
  });
}

export async function handleStartCreatorAppButton(
  interaction: ButtonInteraction,
): Promise<void> {
  const siteBase = env.VFL_SITE_URL.replace(/\/$/, "");
  const url = `${siteBase}/content/creators/onboard?discord_id=${interaction.user.id}`;

  try {
    await interaction.user.send({
      content: [
        "**VF Creator Program** — your personal link (only valid for your Discord account):",
        url,
      ].join("\n\n"),
    });
    await interaction.reply({
      ephemeral: true,
      content:
        "Check your **DMs** for your onboarding link. If nothing appears, enable DMs from this server’s members and try again.",
    });
  } catch {
    await interaction.reply({
      ephemeral: true,
      content: `Couldn’t DM you. Open this link to continue:\n${url}`,
    });
  }
}

function ensureManageRoles(interaction: ButtonInteraction): boolean {
  const ok = interaction.memberPermissions?.has(
    PermissionFlagsBits.ManageRoles,
  );
  if (!ok) {
    interaction
      .reply({
        ephemeral: true,
        content: "You need **Manage Roles** to review creator applications.",
      })
      .catch(() => undefined);
    return false;
  }
  return true;
}

export async function handleCreatorApproveButton(
  interaction: ButtonInteraction,
  appId: string,
): Promise<void> {
  if (!ensureManageRoles(interaction)) return;

  await interaction.deferUpdate();

  const supabase = createBotSupabase();
  const adminId = interaction.user.id;
  const now = new Date().toISOString();

  const { data: row, error: fetchErr } = await supabase
    .from("creator_applications")
    .select("*")
    .eq("id", appId)
    .maybeSingle();

  if (fetchErr || !row) {
    await interaction.editReply({
      content: "Application not found.",
      embeds: [],
      components: [],
    });
    return;
  }

  const rec = row as Record<string, unknown>;
  if (String(rec.status) !== "pending") {
    await interaction.followUp({
      ephemeral: true,
      content: "This application is no longer pending.",
    });
    return;
  }

  const discordId = String(rec.discord_id ?? "");
  const robloxUsername = String(rec.roblox_username ?? "").trim();

  const { error: updErr } = await supabase
    .from("creator_applications")
    .update({
      status: "approved",
      approved_by: adminId,
      approved_at: now,
      updated_at: now,
    })
    .eq("id", appId);

  if (updErr) {
    console.error("[creator] approve update:", updErr);
    await interaction.editReply({
      content: "Database error approving.",
      embeds: interaction.message.embeds,
      components: [],
    });
    return;
  }

  const guildId = vfGuildId();
  const scoutRole = env.DISCORD_SCOUT_ROLE_ID;
  let memberNote = "";

  if (scoutRole) {
    try {
      const guild = await interaction.client.guilds.fetch(guildId);
      let member: GuildMember | null = null;
      try {
        member = await guild.members.fetch(discordId);
      } catch {
        member = null;
      }

      if (member) {
        try {
          await member.roles.add(
            scoutRole,
            `Creator approved by ${interaction.user.tag}`,
          ).catch((e) => console.error("[creator] role add:", e));
        } catch (e) {
          console.error("[creator] role add:", e);
        }
        if (robloxUsername) {
          try {
            await member.setNickname(
              truncateNick(robloxUsername),
              "VF Creator onboarding — Roblox username",
            );
          } catch (e) {
            console.error("[creator] nick:", e);
            memberNote = " (nickname not set — permissions or hierarchy)";
          }
        }
      } else {
        memberNote =
          " User is not in the VF server yet — role/nickname skipped until they join.";
      }
    } catch (e) {
      console.error("[creator] guild member:", e);
      memberNote = " Could not fetch VF guild member.";
    }
  }

  try {
    const u = await interaction.client.users.fetch(discordId);
    await u.send({
      content:
        "You're in. Welcome to **VF Creators**. Check **#new-creator-checklist** (or ask staff) to get started.",
    });
  } catch {
    /* DMs closed */
  }

  const original = interaction.message.embeds[0];
  const builder = original
    ? EmbedBuilder.from(original)
    : new EmbedBuilder().setTitle("Creator application");

  builder.setColor(0x10b981).addFields({
    name: "Approved",
    value: `By <@${adminId}> at <t:${Math.floor(Date.now() / 1000)}:F>${memberNote}`,
    inline: false,
  });

  await interaction.editReply({
    embeds: [builder],
    components: [],
  });
}

export async function handleCreatorRejectButton(
  interaction: ButtonInteraction,
  appId: string,
): Promise<void> {
  if (!ensureManageRoles(interaction)) return;

  const msgId = interaction.message.id;
  const modal = new ModalBuilder()
    .setCustomId(`${CREATOR_REJECT_MODAL_PREFIX}${appId}|${msgId}`)
    .setTitle("Reject application");

  const input = new TextInputBuilder()
    .setCustomId("rejection_reason")
    .setLabel("Reason (optional)")
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(false)
    .setMaxLength(500);

  modal.addComponents(
    new ActionRowBuilder<TextInputBuilder>().addComponents(input),
  );

  await interaction.showModal(modal);
}

export async function handleCreatorRejectModal(
  interaction: ModalSubmitInteraction,
): Promise<void> {
  const raw = interaction.customId.slice(CREATOR_REJECT_MODAL_PREFIX.length);
  const pipe = raw.indexOf("|");
  if (pipe <= 0) {
    await interaction.reply({
      ephemeral: true,
      content: "Invalid modal.",
    });
    return;
  }
  const appId = raw.slice(0, pipe);
  const messageId = raw.slice(pipe + 1);

  await interaction.deferReply({ ephemeral: true });

  const reason =
    interaction.fields.getTextInputValue("rejection_reason")?.trim() ||
    null;
  const adminId = interaction.user.id;
  const now = new Date().toISOString();

  const supabase = createBotSupabase();
  const { data: row, error: fetchErr } = await supabase
    .from("creator_applications")
    .select("*")
    .eq("id", appId)
    .maybeSingle();

  if (fetchErr || !row) {
    await interaction.editReply({
      content: "Application not found.",
    });
    return;
  }

  const rec = row as Record<string, unknown>;
  if (String(rec.status) !== "pending") {
    await interaction.editReply({
      content: "This application is no longer pending.",
    });
    return;
  }

  const discordId = String(rec.discord_id ?? "");

  const { error: updErr } = await supabase
    .from("creator_applications")
    .update({
      status: "rejected",
      approved_by: adminId,
      approved_at: now,
      rejection_reason: reason,
      updated_at: now,
    })
    .eq("id", appId);

  if (updErr) {
    console.error("[creator] reject:", updErr);
    await interaction.editReply({
      content: "Database error.",
    });
    return;
  }

  try {
    const u = await interaction.client.users.fetch(discordId);
    await u.send({
      content:
        "Thanks for applying to **VF Creators**. We’re not able to accept your application at this time.",
    });
  } catch {
    /* ignore */
  }

  const channelId = interaction.channelId;
  if (channelId) {
    try {
      const ch = await interaction.client.channels.fetch(channelId);
      if (ch?.isTextBased()) {
        const msg = await ch.messages.fetch(messageId);
        if (msg.embeds[0]) {
          const builder = EmbedBuilder.from(msg.embeds[0]!);
          builder.setColor(0xef4444).addFields({
            name: "Rejected",
            value: `By <@${adminId}>${reason ? `\n> ${reason}` : ""}`,
            inline: false,
          });
          await msg.edit({
            embeds: [builder],
            components: [],
          });
        }
      }
    } catch (e) {
      console.error("[creator] reject message edit:", e);
    }
  }

  await interaction.editReply({
    content: "Rejected and user notified (if DMs are open).",
  });
}
