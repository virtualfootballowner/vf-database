import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  type GuildMember,
  type GuildTextBasedChannel,
} from "discord.js";

import { env } from "@/bot/config";
import { safeSendDm } from "@/bot/dm";
import { upsertVerifiedPlayer, PlayerIdentityCollisionError } from "@/lib/player-sync";
import {
  extractRobloxUsername,
  getRobloxHeadshots,
  resolveRobloxIdentity,
  type RobloxIdentity,
} from "@/lib/roblox";

export const APPROVE_BUTTON_ID_PREFIX = "vfl:approve:";
export const DENY_BUTTON_ID_PREFIX = "vfl:deny:";

function getDisplayName(member: GuildMember): string | null {
  return (
    member.nickname ??
    member.user.displayName ??
    member.user.username ??
    null
  );
}

/**
 * Resolve Roblox account from how the member appears in Discord.
 * Tries several fields so Rover nicknames, global names, and plain Discord usernames
 * (e.g. matches an existing site profile) still work when one field doesn't parse.
 */
async function resolveIdentityForMember(
  member: GuildMember,
): Promise<RobloxIdentity | null> {
  const rawCandidates = [
    member.nickname,
    member.user.globalName ?? undefined,
    member.user.displayName,
    member.user.username,
    getDisplayName(member),
  ].filter((s): s is string => Boolean(s?.trim()));

  const tried = new Set<string>();
  for (const raw of rawCandidates) {
    const robloxUsername = extractRobloxUsername(raw);
    if (!robloxUsername) continue;
    const key = robloxUsername.toLowerCase();
    if (tried.has(key)) continue;
    tried.add(key);
    try {
      const resolved = await resolveRobloxIdentity(
        robloxUsername,
        env.ROBLOX_API_BASE_URL,
      );
      if (resolved) return resolved;
    } catch {
      continue;
    }
  }
  return null;
}

export async function handleRoverVerified(
  member: GuildMember,
): Promise<void> {
  if (member.roles.cache.has(env.DISCORD_APPROVED_ROLE_ID)) {
    return;
  }

  const rawName = getDisplayName(member);
  const identity = await resolveIdentityForMember(member);

  let headshot: string | undefined;
  if (identity) {
    const headshots = await getRobloxHeadshots([identity.userId]);
    headshot = headshots.get(identity.userId);
  }

  const channel = await member.guild.channels.fetch(
    env.DISCORD_STAFF_REVIEW_CHANNEL_ID,
  );
  if (!channel || !channel.isTextBased() || !channel.isSendable()) {
    console.error(
      `Staff review channel ${env.DISCORD_STAFF_REVIEW_CHANNEL_ID} is not a sendable text channel.`,
    );
    return;
  }

  const embed = new EmbedBuilder()
    .setTitle(
      identity
        ? "New player pending approval"
        : "Pending review · nickname mismatch",
    )
    .setColor(identity ? 0x083696 : 0xb0734f)
    .addFields(
      {
        name: "Discord",
        value: `${member.user} (\`${member.user.username}\`)`,
        inline: false,
      },
      identity
        ? {
            name: "Roblox",
            value: `[${identity.username}](https://www.roblox.com/users/${identity.userId}/profile) · ID \`${identity.userId}\``,
            inline: false,
          }
        : {
            name: "Roblox",
            value: rawName
              ? `Couldn't resolve a Roblox username from nickname \`${rawName}\``
              : "No nickname set",
            inline: false,
          },
    )
    .setFooter({ text: "Use the buttons below to approve or deny." })
    .setTimestamp(new Date());

  const avatar = member.user.displayAvatarURL({ size: 128 });
  if (avatar) embed.setThumbnail(avatar);
  if (headshot) embed.setImage(headshot);

  const components = buildReviewButtons(member.id, { canApprove: !!identity });

  await (channel as GuildTextBasedChannel).send({
    embeds: [embed],
    components: [components],
  });

  const welcomeEmbed = new EmbedBuilder()
    .setColor(0x083696)
    .setTitle("👋 Welcome to VFL")
    .setDescription(
      identity
        ? `Hey **${identity.username}** — your Roblox verification has been received.`
        : "Hey — your Roblox verification has been received.",
    )
    .addFields({
      name: "📋 What happens next",
      value:
        "A staff member will review your registration shortly. You'll get one more message here once you've been ✅ approved or ❌ denied.",
    })
    .setFooter({
      text: "VFL Bot · You're getting this DM because you just completed verification on the VFL website",
    })
    .setTimestamp(new Date());

  await safeSendDm(member, { embeds: [welcomeEmbed] }, "verify-welcome");
}

export async function handleApprovedRoleAdded(
  member: GuildMember,
  options: { sendDm?: boolean } = {},
): Promise<boolean> {
  const identity = await resolveIdentityForMember(member);
  if (!identity) {
    console.warn(
      `Approved role on ${member.user.username} but no Roblox identity could be resolved; skipping Supabase sync.`,
    );
    return false;
  }

  try {
    await upsertVerifiedPlayer({
      discordId: member.id,
      discordUsername: member.user.username,
      robloxUsername: identity.username,
      robloxUserId: identity.userId,
    });
  } catch (e) {
    if (e instanceof PlayerIdentityCollisionError) {
      console.warn(
        `Supabase sync skipped for ${member.user.tag}: ${e.message}`,
      );
      return false;
    }
    throw e;
  }

  if (options.sendDm) {
    const profileUrl = `${env.VFL_SITE_URL.replace(/\/$/, "")}/players/${encodeURIComponent(identity.username)}`;

    const approvedEmbed = new EmbedBuilder()
      .setColor(0x10b981)
      .setTitle("🎉 You're approved!")
      .setDescription(
        `You now have full access to the VFL Discord and your profile is live at **[${env.VFL_SITE_URL.replace(/^https?:\/\//, "").replace(/\/$/, "")}/players](${profileUrl})**.`,
      )
      .addFields(
        {
          name: "🎮 Roblox",
          value: `[${identity.username}](https://www.roblox.com/users/${identity.userId}/profile)`,
          inline: true,
        },
        {
          name: "🌐 VFL Profile",
          value: `[View on website](${profileUrl})`,
          inline: true,
        },
      )
      .setFooter({
        text: "VFL Bot · You're getting this DM because your VFL registration was approved",
      })
      .setTimestamp(new Date());

    await safeSendDm(member, { embeds: [approvedEmbed] }, "verify-approved");
  }

  return true;
}

export function buildReviewButtons(
  discordId: string,
  options: { canApprove: boolean } = { canApprove: true },
): ActionRowBuilder<ButtonBuilder> {
  const row = new ActionRowBuilder<ButtonBuilder>();
  if (options.canApprove) {
    row.addComponents(
      new ButtonBuilder()
        .setCustomId(`${APPROVE_BUTTON_ID_PREFIX}${discordId}`)
        .setLabel("Approve")
        .setStyle(ButtonStyle.Success),
    );
  }
  row.addComponents(
    new ButtonBuilder()
      .setCustomId(`${DENY_BUTTON_ID_PREFIX}${discordId}`)
      .setLabel("Deny")
      .setStyle(ButtonStyle.Danger),
  );
  return row;
}
