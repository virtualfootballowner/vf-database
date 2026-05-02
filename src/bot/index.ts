import "dotenv/config";

import {
  Client,
  ComponentType,
  EmbedBuilder,
  Events,
  GatewayIntentBits,
  MessageFlags,
  PermissionFlagsBits,
  type ButtonInteraction,
  type Guild,
  type GuildBasedChannel,
  type GuildMember,
  type GuildTextBasedChannel,
  type Interaction,
  type User,
} from "discord.js";


import { env } from "@/bot/config";
import {
  CONTRACT_BTN_APPROVE,
  CONTRACT_BTN_DENY,
  handleContractButton,
} from "@/bot/contracts";
import {
  RELEASE_BTN_APPROVE,
  RELEASE_BTN_DENY,
  handleReleaseStaffButton,
} from "@/bot/release";
import {
  handleAutocomplete,
  handleSlashCommand,
  slashCommandDefinitions,
} from "@/bot/commands";
import {
  cancelRoverVerifyDeadline,
  handleMemberJoinVerifyGate,
} from "@/bot/join-verify-gate";
import {
  handleMemberRemoveOutgoing,
  logMemberOutgoingStartup,
  postMemberOutgoing,
} from "@/bot/member-outgoing";
import {
  APPROVE_BUTTON_ID_PREFIX,
  DENY_BUTTON_ID_PREFIX,
  handleApprovedRoleAdded,
  handleRoverVerified,
} from "@/bot/sync";

/** When staff uses the Approve button, we sync here; skip duplicate work if GuildMemberUpdate fires too. */
const approvalSyncOwnedByButton = new Set<string>();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildModeration,
  ],
});

async function runBackfill() {
  const guild = await client.guilds.fetch(env.DISCORD_GUILD_ID);
  const members = await guild.members.fetch();

  let synced = 0;
  for (const member of members.values()) {
    if (!member.roles.cache.has(env.DISCORD_APPROVED_ROLE_ID)) continue;
    try {
      const ok = await handleApprovedRoleAdded(member as GuildMember);
      if (ok) synced++;
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
  logMemberOutgoingStartup();

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

client.on(Events.GuildMemberAdd, async (member) => {
  try {
    await handleMemberJoinVerifyGate(client, member as GuildMember);
  } catch (error) {
    console.error("GuildMemberAdd verify gate failed:", error);
  }
});

client.on(Events.GuildMemberUpdate, async (oldMember, newMember) => {
  try {
    const member = newMember as GuildMember;
    if (
      member.roles.cache.has(env.DISCORD_ROVER_VERIFIED_ROLE_ID) ||
      member.roles.cache.has(env.DISCORD_APPROVED_ROLE_ID)
    ) {
      cancelRoverVerifyDeadline(member.id);
    }

    const oldRoles = oldMember.roles.cache;
    const newRoles = newMember.roles.cache;

    const roverNowVerified =
      !oldRoles.has(env.DISCORD_ROVER_VERIFIED_ROLE_ID) &&
      newRoles.has(env.DISCORD_ROVER_VERIFIED_ROLE_ID);

    const approvedNowGranted =
      !oldRoles.has(env.DISCORD_APPROVED_ROLE_ID) &&
      newRoles.has(env.DISCORD_APPROVED_ROLE_ID);

    if (approvedNowGranted) {
      if (approvalSyncOwnedByButton.has(member.id)) {
        return;
      }
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

client.on(Events.GuildBanAdd, async (ban) => {
  try {
    if (ban.guild.id !== env.DISCORD_GUILD_ID) return;
    await postMemberOutgoing(ban.guild, ban.user, "banned");
  } catch (error) {
    console.error("GuildBanAdd outgoing log failed:", error);
  }
});

client.on(Events.GuildMemberRemove, async (member) => {
  try {
    if (member.id) cancelRoverVerifyDeadline(member.id);
    if (!member.id || !member.guild) return;
    await closeReviewCardsFor(member.guild, member.id);

    if (member.guild.id !== env.DISCORD_GUILD_ID) return;

    let user: User | null = member.user;
    if (!user) {
      try {
        user = await client.users.fetch(member.id);
      } catch {
        console.error(
          "GuildMemberRemove: could not resolve User for outgoing log;",
          "member id",
          member.id,
        );
        return;
      }
    }

    const guild = member.guild;
    void handleMemberRemoveOutgoing(guild, user).catch((err) => {
      console.error("handleMemberRemoveOutgoing failed:", err);
    });
  } catch (error) {
    console.error("Failed to close cards for departing member:", error);
  }
});

client.on(Events.InteractionCreate, async (interaction: Interaction) => {
  try {
    if (interaction.isAutocomplete()) {
      await handleAutocomplete(interaction);
      return;
    }

    if (interaction.isChatInputCommand()) {
      await handleSlashCommand(interaction);
      return;
    }

    if (!interaction.isButton()) return;
    const customId = interaction.customId;

    if (customId.startsWith(CONTRACT_BTN_APPROVE)) {
      await handleContractButton(
        interaction,
        "approve",
        customId.slice(CONTRACT_BTN_APPROVE.length),
      );
      return;
    }
    if (customId.startsWith(CONTRACT_BTN_DENY)) {
      await handleContractButton(
        interaction,
        "deny",
        customId.slice(CONTRACT_BTN_DENY.length),
      );
      return;
    }

    if (customId.startsWith(RELEASE_BTN_APPROVE)) {
      await handleReleaseStaffButton(
        interaction,
        "approve",
        customId.slice(RELEASE_BTN_APPROVE.length),
      );
      return;
    }
    if (customId.startsWith(RELEASE_BTN_DENY)) {
      await handleReleaseStaffButton(
        interaction,
        "deny",
        customId.slice(RELEASE_BTN_DENY.length),
      );
      return;
    }

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

  approvalSyncOwnedByButton.add(member.id);
  try {
    if (!member.roles.cache.has(env.DISCORD_APPROVED_ROLE_ID)) {
      await member.roles.add(
        env.DISCORD_APPROVED_ROLE_ID,
        `Approved by ${interaction.user.tag}`,
      );
    }
  } catch (error) {
    approvalSyncOwnedByButton.delete(member.id);
    console.error("Failed to add Approved role:", error);
    await markCard(interaction, {
      verb: "Approve failed",
      detail:
        "Bot couldn't grant the Approved role. Check role hierarchy and Manage Roles permission.",
      color: 0xef4444,
    });
    return;
  }

  let syncOk = false;
  try {
    syncOk = await handleApprovedRoleAdded(member, { sendDm: true });
  } catch (syncErr) {
    console.error("Post-approve Supabase/DM sync failed:", syncErr);
  } finally {
    setTimeout(() => approvalSyncOwnedByButton.delete(member.id), 3000);
  }

  await markCard(interaction, {
    verb: syncOk ? "Approved" : "Approved (sync failed)",
    detail: syncOk
      ? `by ${interaction.user}`
      : [
          `Role granted by ${interaction.user}.`,
          "Database or DM step failed — check bot logs (nickname must map to a Roblox username, or run backfill after fixing).",
        ].join(" "),
    color: syncOk ? 0x10b981 : 0xb0734f,
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
          "Reach out to a staff member in the VFL Discord and try again via the site’s **Click to verify** link.",
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

async function closeReviewCardsFor(
  guild: Guild,
  discordId: string,
): Promise<void> {
  let channel: GuildBasedChannel | null;
  try {
    channel = await guild.channels.fetch(env.DISCORD_STAFF_REVIEW_CHANNEL_ID);
  } catch {
    return;
  }
  if (!channel || !channel.isTextBased()) return;

  let messages;
  try {
    messages = await (channel as GuildTextBasedChannel).messages.fetch({
      limit: 100,
    });
  } catch {
    return;
  }

  const approveId = `${APPROVE_BUTTON_ID_PREFIX}${discordId}`;
  const denyId = `${DENY_BUTTON_ID_PREFIX}${discordId}`;

  for (const message of messages.values()) {
    const cardOwnedByMember = (message.components ?? []).some((row) => {
      if (row.type !== ComponentType.ActionRow) return false;
      return row.components.some((component) => {
        if (component.type !== ComponentType.Button) return false;
        const id = component.customId;
        return id === approveId || id === denyId;
      });
    });

    if (!cardOwnedByMember) continue;

    const original = message.embeds[0];
    const builder = original
      ? EmbedBuilder.from(original)
      : new EmbedBuilder().setTitle("Review");

    builder
      .setColor(0x6b7280)
      .addFields({
        name: "🚪 Member left",
        value: "Player is no longer in the server. Card auto-closed.",
        inline: false,
      })
      .setFooter({ text: `Auto-closed at ${new Date().toUTCString()}` });

    try {
      await message.edit({
        embeds: [builder],
        components: [],
      });
    } catch (error) {
      console.error("Failed to edit card for left member:", error);
    }
  }
}

void client.login(env.DISCORD_BOT_TOKEN);
