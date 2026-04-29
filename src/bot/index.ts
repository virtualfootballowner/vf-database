import "dotenv/config";

import {
  Client,
  EmbedBuilder,
  Events,
  GatewayIntentBits,
  MessageFlags,
  PermissionFlagsBits,
  type ButtonInteraction,
  type GuildMember,
  type Interaction,
} from "discord.js";


import { env } from "@/bot/config";
import {
  handleSlashCommand,
  slashCommandDefinitions,
} from "@/bot/commands";
import {
  APPROVE_BUTTON_ID_PREFIX,
  DENY_BUTTON_ID_PREFIX,
  handleApprovedRoleAdded,
  handleRoverVerified,
} from "@/bot/sync";

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
  ],
});

async function runBackfill() {
  const guild = await client.guilds.fetch(env.DISCORD_GUILD_ID);
  const members = await guild.members.fetch();

  let synced = 0;
  for (const member of members.values()) {
    if (!member.roles.cache.has(env.DISCORD_APPROVED_ROLE_ID)) continue;
    try {
      await handleApprovedRoleAdded(member as GuildMember);
      synced++;
    } catch (error) {
      console.error(
        `Backfill sync failed for ${member.user.username}:`,
        error,
      );
    }
  }
  console.log(
    `Backfill complete: synced ${synced} approved member${synced === 1 ? "" : "s"}.`,
  );
}

client.once(Events.ClientReady, async (readyClient) => {
  console.log(`Discord bot online as ${readyClient.user.tag}`);

  try {
    const guild = await client.guilds.fetch(env.DISCORD_GUILD_ID);
    await guild.commands.set(slashCommandDefinitions);
    console.log(
      `Registered ${slashCommandDefinitions.length} slash command${
        slashCommandDefinitions.length === 1 ? "" : "s"
      }.`,
    );
  } catch (error) {
    console.error("Failed to register slash commands:", error);
  }

  try {
    await runBackfill();
  } catch (error) {
    console.error("Backfill failed:", error);
  }
});

client.on(Events.GuildMemberUpdate, async (oldMember, newMember) => {
  try {
    const member = newMember as GuildMember;
    const oldRoles = oldMember.roles.cache;
    const newRoles = newMember.roles.cache;

    const roverNowVerified =
      !oldRoles.has(env.DISCORD_ROVER_VERIFIED_ROLE_ID) &&
      newRoles.has(env.DISCORD_ROVER_VERIFIED_ROLE_ID);

    const approvedNowGranted =
      !oldRoles.has(env.DISCORD_APPROVED_ROLE_ID) &&
      newRoles.has(env.DISCORD_APPROVED_ROLE_ID);

    if (approvedNowGranted) {
      await handleApprovedRoleAdded(member, { sendDm: true });
      return;
    }

    if (roverNowVerified) {
      await handleRoverVerified(member);
    }
  } catch (error) {
    console.error("Member update handling failed:", error);
  }
});

client.on(Events.InteractionCreate, async (interaction: Interaction) => {
  try {
    if (interaction.isChatInputCommand()) {
      await handleSlashCommand(interaction);
      return;
    }

    if (!interaction.isButton()) return;
    const customId = interaction.customId;

    if (customId.startsWith(APPROVE_BUTTON_ID_PREFIX)) {
      const discordId = customId.slice(APPROVE_BUTTON_ID_PREFIX.length);
      await handleApproveClick(interaction, discordId);
      return;
    }

    if (customId.startsWith(DENY_BUTTON_ID_PREFIX)) {
      const discordId = customId.slice(DENY_BUTTON_ID_PREFIX.length);
      await handleDenyClick(interaction, discordId);
      return;
    }
  } catch (error) {
    console.error("Interaction handler failed:", error);
  }
});

async function handleApproveClick(
  interaction: ButtonInteraction,
  discordId: string,
): Promise<void> {
  if (!ensureStaff(interaction)) return;

  await interaction.deferUpdate();

  const guild = interaction.guild;
  if (!guild) return;

  let member: GuildMember | null = null;
  try {
    member = await guild.members.fetch(discordId);
  } catch {
    member = null;
  }

  if (!member) {
    await markCard(interaction, {
      verb: "Could not approve",
      detail: "Player is no longer in the server.",
      color: 0xef4444,
    });
    return;
  }

  try {
    if (!member.roles.cache.has(env.DISCORD_APPROVED_ROLE_ID)) {
      await member.roles.add(
        env.DISCORD_APPROVED_ROLE_ID,
        `Approved by ${interaction.user.tag}`,
      );
    }
  } catch (error) {
    console.error("Failed to add Approved role:", error);
    await markCard(interaction, {
      verb: "Approve failed",
      detail:
        "Bot couldn't grant the Approved role. Check role hierarchy and Manage Roles permission.",
      color: 0xef4444,
    });
    return;
  }

  await markCard(interaction, {
    verb: "Approved",
    detail: `by ${interaction.user}`,
    color: 0x10b981,
  });
}

async function handleDenyClick(
  interaction: ButtonInteraction,
  discordId: string,
): Promise<void> {
  if (!ensureStaff(interaction)) return;

  await interaction.deferUpdate();

  const guild = interaction.guild;
  if (!guild) return;

  let member: GuildMember | null = null;
  try {
    member = await guild.members.fetch(discordId);
  } catch {
    member = null;
  }

  if (!member) {
    await markCard(interaction, {
      verb: "Denied",
      detail: `by ${interaction.user} (player already left)`,
      color: 0x6b7280,
    });
    return;
  }

  let dmDelivered = true;
  try {
    const denialEmbed = new EmbedBuilder()
      .setColor(0xef4444)
      .setTitle("❌ Application Not Approved")
      .setDescription("Your VFL registration was not approved.")
      .addFields({
        name: "💬 Think this is a mistake?",
        value:
          "Reach out to a staff member in the VFL Discord and try re-verifying.",
      })
      .setFooter({ text: "VFL Bot" })
      .setTimestamp(new Date());

    await member.send({ embeds: [denialEmbed] });
  } catch {
    dmDelivered = false;
  }

  let kicked = true;
  try {
    await member.kick(`Denied by ${interaction.user.tag} via VFBot review`);
  } catch (error) {
    console.error("Failed to kick denied member:", error);
    kicked = false;
  }

  await markCard(interaction, {
    verb: "Denied",
    detail: [
      `by ${interaction.user}`,
      kicked ? "Kicked from server." : "Kick FAILED — check Kick Members permission.",
      dmDelivered ? "Denial DM delivered." : "DM not delivered (user blocks DMs).",
    ].join(" · "),
    color: kicked ? 0xef4444 : 0xb0734f,
  });
}

function ensureStaff(interaction: ButtonInteraction): boolean {
  const hasPerm = interaction.memberPermissions?.has(
    PermissionFlagsBits.ManageRoles,
  );
  if (!hasPerm) {
    interaction
      .reply({
        flags: MessageFlags.Ephemeral,
        content: "You need the Manage Roles permission to use these buttons.",
      })
      .catch(() => undefined);
    return false;
  }
  return true;
}

async function markCard(
  interaction: ButtonInteraction,
  outcome: { verb: string; detail: string; color: number },
): Promise<void> {
  const original = interaction.message.embeds[0];
  const builder = original
    ? EmbedBuilder.from(original)
    : new EmbedBuilder().setTitle("Review");

  builder
    .setColor(outcome.color)
    .addFields({
      name: outcome.verb,
      value: outcome.detail,
      inline: false,
    })
    .setFooter({ text: `Resolved at ${new Date().toUTCString()}` });

  try {
    await interaction.editReply({
      embeds: [builder],
      components: [],
    });
  } catch (error) {
    console.error("Failed to update review card:", error);
  }
}

void client.login(env.DISCORD_BOT_TOKEN);
