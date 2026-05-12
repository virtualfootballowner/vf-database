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
  CREATOR_APPROVE_PREFIX,
  CREATOR_POST_REMOVE_APPROVE_PREFIX,
  CREATOR_POST_REMOVE_REJECT_MODAL_PREFIX,
  CREATOR_POST_REMOVE_REJECT_PREFIX,
  CREATOR_REJECT_MODAL_PREFIX,
  CREATOR_REJECT_PREFIX,
  CREATOR_START_APP_BUTTON,
} from "@/lib/creator-onboard/creator-discord-constants";
import {
  handleCreatorApproveButton,
  handleCreatorPostRemoveApproveButton,
  handleCreatorPostRemoveCommand,
  handleCreatorPostRemoveRejectButton,
  handleCreatorPostRemoveRejectModal,
  handleCreatorRejectButton,
  handleCreatorRejectModal,
  handleStartCreatorAppButton,
} from "@/bot/creator-onboard";
import {
  RELEASE_BTN_APPROVE,
  RELEASE_BTN_DENY,
  handleReleaseStaffButton,
} from "@/bot/release";
import {
  handleScrimmageButton,
  handleScrimmageSelect,
  isScrimmageCustomId,
} from "@/bot/scrimmage/interactions";
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
  clearPlayerDiscordBanFromGuild,
  setPlayerDiscordBanFromGuild,
} from "@/bot/player-discord-ban-sync";
import { createBotSupabase } from "@/bot/stats-queries";
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

/** OAuth2 URL for this application’s bot user (use when the token sees zero guilds or the env guild id). */
function oauthBotInviteUrl(clientId: string): string {
  const perms = [
    PermissionFlagsBits.ViewChannel,
    PermissionFlagsBits.SendMessages,
    PermissionFlagsBits.EmbedLinks,
    PermissionFlagsBits.AttachFiles,
    PermissionFlagsBits.ReadMessageHistory,
    PermissionFlagsBits.ManageRoles,
    PermissionFlagsBits.ManageNicknames,
    PermissionFlagsBits.ManageGuild,
    PermissionFlagsBits.KickMembers,
    PermissionFlagsBits.BanMembers,
  ].reduce<bigint>((a, b) => a | BigInt(b), BigInt(0));
  const q = new URLSearchParams({
    client_id: clientId,
    permissions: perms.toString(),
    scope: "bot applications.commands",
  });
  return `https://discord.com/oauth2/authorize?${q}`;
}

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
  const guildSummaries = [...readyClient.guilds.cache.values()]
    .map((g) => `${g.name} (${g.id})`)
    .sort((a, b) => a.localeCompare(b));
  console.log(
    `Guilds visible to this token (${readyClient.guilds.cache.size}): ${guildSummaries.join("; ") || "(none)"}`,
  );
  console.log(`DISCORD_GUILD_ID from env: ${env.DISCORD_GUILD_ID}`);
  if (!readyClient.guilds.cache.has(env.DISCORD_GUILD_ID)) {
    console.log(
      "This token cannot use DISCORD_GUILD_ID — wrong server id, or this Discord app is not installed in that server.",
    );
    console.log(`Install / re-invite this app: ${oauthBotInviteUrl(readyClient.user.id)}`);
  }
  logMemberOutgoingStartup();

  try {
    const reset = process.env.DISCORD_FORCE_RESET_COMMANDS === "1";
    for (const [, guild] of readyClient.guilds.cache) {
      if (reset) {
        const existing = await guild.commands.fetch();
        console.log(
          `[reset] ${guild.name}: deleting ${existing.size} slash command(s)…`,
        );
        for (const cmd of existing.values()) {
          try {
            await cmd.delete();
          } catch (e) {
            console.error(`[reset] Failed to delete /${cmd.name}:`, e);
          }
        }
      }
      await guild.commands.set(slashCommandDefinitions);
      console.log(
        `Registered ${slashCommandDefinitions.length} slash command(s) in **${guild.name}** (${guild.id}).`,
      );
    }
  } catch (error) {
    console.error("Failed to register slash commands:", error);
  }

  try {
    await runBackfill();
  } catch (error) {
    console.error("Backfill failed:", error);
  }
});

client.on(Events.GuildCreate, async (guild) => {
  try {
    await guild.commands.set(slashCommandDefinitions);
    console.log(
      `[guild-join] Registered ${slashCommandDefinitions.length} slash command(s) in **${guild.name}** (${guild.id}).`,
    );
  } catch (error) {
    console.error(
      `[guild-join] Failed to register commands in ${guild.id}:`,
      error,
    );
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
    try {
      await setPlayerDiscordBanFromGuild(createBotSupabase(), ban.user.id, {
        at: new Date(),
        reason: ban.reason ?? null,
      });
    } catch (syncErr) {
      console.error("GuildBanAdd player ban sync failed:", syncErr);
    }
  } catch (error) {
    console.error("GuildBanAdd outgoing log failed:", error);
  }
});

client.on(Events.GuildBanRemove, async (ban) => {
  try {
    if (ban.guild.id !== env.DISCORD_GUILD_ID) return;
    try {
      await clearPlayerDiscordBanFromGuild(createBotSupabase(), ban.user.id);
    } catch (syncErr) {
      console.error("GuildBanRemove player ban sync failed:", syncErr);
    }
  } catch (error) {
    console.error("GuildBanRemove handling failed:", error);
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

    if (interaction.isStringSelectMenu()) {
      if (isScrimmageCustomId(interaction.customId)) {
        await handleScrimmageSelect(interaction);
      }
      return;
    }

    if (interaction.isModalSubmit()) {
      if (
        interaction.customId.startsWith(CREATOR_POST_REMOVE_REJECT_MODAL_PREFIX)
      ) {
        await handleCreatorPostRemoveRejectModal(interaction);
        return;
      }
      if (
        interaction.customId.startsWith(CREATOR_REJECT_MODAL_PREFIX)
      ) {
        await handleCreatorRejectModal(interaction);
      }
      return;
    }

    if (!interaction.isButton()) return;
    const customId = interaction.customId;

    if (isScrimmageCustomId(customId)) {
      await handleScrimmageButton(interaction);
      return;
    }

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

    if (customId.startsWith(CREATOR_POST_REMOVE_APPROVE_PREFIX)) {
      await handleCreatorPostRemoveApproveButton(
        interaction,
        customId.slice(CREATOR_POST_REMOVE_APPROVE_PREFIX.length),
      );
      return;
    }
    if (customId.startsWith(CREATOR_POST_REMOVE_REJECT_PREFIX)) {
      await handleCreatorPostRemoveRejectButton(
        interaction,
        customId.slice(CREATOR_POST_REMOVE_REJECT_PREFIX.length),
      );
      return;
    }

    if (customId === CREATOR_START_APP_BUTTON) {
      await handleStartCreatorAppButton(interaction);
      return;
    }

    if (customId.startsWith(CREATOR_APPROVE_PREFIX)) {
      await handleCreatorApproveButton(
        interaction,
        customId.slice(CREATOR_APPROVE_PREFIX.length),
      );
      return;
    }

    if (customId.startsWith(CREATOR_REJECT_PREFIX)) {
      await handleCreatorRejectButton(
        interaction,
        customId.slice(CREATOR_REJECT_PREFIX.length),
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
