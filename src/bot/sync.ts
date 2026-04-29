import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  type GuildMember,
  type GuildTextBasedChannel,
} from "discord.js";

import { env } from "@/bot/config";
import { upsertVerifiedPlayer } from "@/lib/player-sync";
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

async function resolveIdentityForMember(
  member: GuildMember,
): Promise<RobloxIdentity | null> {
  const rawName = getDisplayName(member);
  if (!rawName) return null;
  const robloxUsername = extractRobloxUsername(rawName);
  if (!robloxUsername) return null;
  try {
    return await resolveRobloxIdentity(
      robloxUsername,
      env.ROBLOX_API_BASE_URL,
    );
  } catch {
    return null;
  }
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

  try {
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
          "A staff member will review your registration shortly. You'll get another DM here once you've been ✅ approved or ❌ denied.",
      })
      .setFooter({ text: "VFL Bot" })
      .setTimestamp(new Date());

    await member.send({ embeds: [welcomeEmbed] });
  } catch {
    // user has DMs disabled — not fatal, the staff card was posted regardless
  }
}

export async function handleApprovedRoleAdded(
  member: GuildMember,
  options: { sendDm?: boolean } = {},
): Promise<void> {
  const identity = await resolveIdentityForMember(member);
  if (!identity) {
    console.warn(
      `Approved role on ${member.user.username} but no Roblox identity could be resolved; skipping Supabase sync.`,
    );
    return;
  }

  await upsertVerifiedPlayer({
    discordId: member.id,
    discordUsername: member.user.username,
    robloxUsername: identity.username,
    robloxUserId: identity.userId,
  });

  if (options.sendDm) {
    try {
      const approvedEmbed = new EmbedBuilder()
        .setColor(0x10b981)
        .setTitle("🎉 You're approved!")
        .setDescription(
          "You now have full access to the VFL Discord and your profile is live on the league website.",
        )
        .addFields({
          name: "🎮 Roblox",
          value: `[${identity.username}](https://www.roblox.com/users/${identity.userId}/profile)`,
          inline: true,
        })
        .setFooter({ text: "Good luck out there ⚽" })
        .setTimestamp(new Date());

      await member.send({ embeds: [approvedEmbed] });
    } catch {
      // user has DMs disabled — sync still happened, that's the important part
    }
  }
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
