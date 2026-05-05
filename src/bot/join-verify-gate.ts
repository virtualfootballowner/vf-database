import {
  Client,
  EmbedBuilder,
  type GuildMember,
  type GuildTextBasedChannel,
} from "discord.js";

import { env } from "@/bot/config";

const ROVER_VERIFY_DEADLINE_MINUTES: number = 10;
const ROVER_VERIFY_REMINDER_MINUTES_BEFORE_KICK: number = 2;

const ROVER_VERIFY_DEADLINE_MS = ROVER_VERIFY_DEADLINE_MINUTES * 60 * 1000;
const ROVER_VERIFY_REMINDER_AT_MS = Math.max(
  0,
  ROVER_VERIFY_DEADLINE_MS -
    ROVER_VERIFY_REMINDER_MINUTES_BEFORE_KICK * 60 * 1000,
);

function deadlineLabel(): string {
  return ROVER_VERIFY_DEADLINE_MINUTES === 1
    ? "1 minute"
    : `${ROVER_VERIFY_DEADLINE_MINUTES} minutes`;
}

function reminderLabel(): string {
  const seconds = ROVER_VERIFY_REMINDER_MINUTES_BEFORE_KICK * 60;
  if (seconds < 60) return `${Math.round(seconds)} seconds`;
  if (ROVER_VERIFY_REMINDER_MINUTES_BEFORE_KICK === 1) return "1 minute";
  if (Number.isInteger(ROVER_VERIFY_REMINDER_MINUTES_BEFORE_KICK)) {
    return `${ROVER_VERIFY_REMINDER_MINUTES_BEFORE_KICK} minutes`;
  }
  return `${ROVER_VERIFY_REMINDER_MINUTES_BEFORE_KICK} minutes`;
}

const kickTimers = new Map<string, NodeJS.Timeout>();
const reminderTimers = new Map<string, NodeJS.Timeout>();

export function cancelRoverVerifyDeadline(userId: string): void {
  const t = kickTimers.get(userId);
  if (t) {
    clearTimeout(t);
    kickTimers.delete(userId);
  }
  const r = reminderTimers.get(userId);
  if (r) {
    clearTimeout(r);
    reminderTimers.delete(userId);
  }
}

function needsRoverGate(member: GuildMember): boolean {
  if (member.user.bot) return false;
  if (member.guild.id !== env.DISCORD_GUILD_ID) return false;
  if (member.roles.cache.has(env.DISCORD_ROVER_VERIFIED_ROLE_ID)) return false;
  if (member.roles.cache.has(env.DISCORD_APPROVED_ROLE_ID)) return false;
  return true;
}

/**
 * Resolve the public verify channel where join-gate notifications get posted.
 * Returns null when DISCORD_VERIFY_CHANNEL_ID is unset (silent gate mode) or
 * when the channel can't be reached / isn't sendable.
 */
async function resolveVerifyChannel(
  client: Client,
): Promise<GuildTextBasedChannel | null> {
  const channelId = env.DISCORD_VERIFY_CHANNEL_ID;
  if (!channelId) return null;
  let channel;
  try {
    channel = await client.channels.fetch(channelId);
  } catch {
    return null;
  }
  if (!channel || !channel.isTextBased()) return null;
  if (!("isSendable" in channel) || !channel.isSendable()) return null;
  return channel as GuildTextBasedChannel;
}

let verifyChannelMissingWarned = false;
function warnMissingVerifyChannelOnce(): void {
  if (verifyChannelMissingWarned) return;
  verifyChannelMissingWarned = true;
  console.warn(
    "[join-gate] DISCORD_VERIFY_CHANNEL_ID is not set — new joiners will NOT receive any verify notification. " +
      "Set it to your public verify channel id to ping joiners there. (Old behavior of DMing every joiner is permanently disabled to avoid Discord spam flags.)",
  );
}

/**
 * Public-channel join gate: pings the new member in the verify channel,
 * sends one reminder ping near the deadline, and kicks if not verified in time.
 *
 * The previous version of this flow DM'd each new joiner up to 3 times. That
 * pattern (bulk DMs to users who never interacted with the bot) is what
 * caused the previous bot account to be flagged by Discord, so DMs have been
 * removed entirely from this flow — every notification now goes to the
 * public verify channel where the user can opt in by clicking through.
 */
export async function handleMemberJoinVerifyGate(
  client: Client,
  member: GuildMember,
): Promise<void> {
  if (!needsRoverGate(member)) return;

  cancelRoverVerifyDeadline(member.id);

  const dl = deadlineLabel();
  const rem = reminderLabel();
  const verifyUrl = `${env.VFL_SITE_URL.replace(/\/$/, "")}/verify`;

  const verifyChannel = await resolveVerifyChannel(client);
  if (!verifyChannel) {
    warnMissingVerifyChannelOnce();
  } else {
    const embed = new EmbedBuilder()
      .setColor(0xf59e0b)
      .setTitle(`⏱️ ${dl} to verify`)
      .setDescription(
        `Welcome to **VFL**. Open **[Click to verify](${verifyUrl})** and sign in with **Discord**, then **Roblox**, within **${dl}** or you will be **removed** automatically.`,
      )
      .addFields({
        name: "What to do",
        value: `Use the link above on the VFL website (works on mobile). You'll get one more ping in this channel with **${rem} left** if you're not verified yet. If you're stuck, open a ticket or ask staff — the timer does not pause.`,
      })
      .setFooter({ text: "VFL Bot · Posted here so we don't have to DM you" })
      .setTimestamp();
    try {
      await verifyChannel.send({
        content: `${member} — heads up:`,
        embeds: [embed],
        allowedMentions: { users: [member.id] },
      });
    } catch (err) {
      console.warn(
        `[join-gate] Could not post welcome ping for ${member.user.tag} in verify channel:`,
        err,
      );
    }
  }

  const userId = member.id;

  const reminderTimeout = setTimeout(() => {
    void (async () => {
      reminderTimers.delete(userId);
      try {
        const guild = await client.guilds.fetch(env.DISCORD_GUILD_ID);
        const m = await guild.members.fetch(userId).catch(() => null);
        if (!m) return;
        if (m.roles.cache.has(env.DISCORD_ROVER_VERIFIED_ROLE_ID)) return;
        if (m.roles.cache.has(env.DISCORD_APPROVED_ROLE_ID)) return;
        const channel = await resolveVerifyChannel(client);
        if (!channel) return;
        const remindEmbed = new EmbedBuilder()
          .setColor(0xea580c)
          .setTitle(`⏱️ ${rem} left to verify`)
          .setDescription(
            `You still need to finish **[Click to verify](${verifyUrl})** in **VFL**. About **${rem}** remain before you are removed from the server.`,
          )
          .addFields({
            name: "Verify now",
            value:
              "Complete Discord + Roblox sign-in on the site immediately. This is your last heads-up before an automatic kick.",
          })
          .setFooter({ text: "VFL Bot · Final reminder before auto-kick" })
          .setTimestamp();
        await channel.send({
          content: `${m} — last call:`,
          embeds: [remindEmbed],
          allowedMentions: { users: [m.id] },
        });
      } catch (err) {
        console.warn(
          `[join-gate] Could not post reminder for ${userId}:`,
          err,
        );
      }
    })();
  }, ROVER_VERIFY_REMINDER_AT_MS);
  reminderTimers.set(userId, reminderTimeout);

  const timeout = setTimeout(() => {
    void (async () => {
      kickTimers.delete(userId);
      try {
        const guild = await client.guilds.fetch(env.DISCORD_GUILD_ID);
        const m = await guild.members.fetch(userId).catch(() => null);
        if (!m) return;
        if (m.roles.cache.has(env.DISCORD_ROVER_VERIFIED_ROLE_ID)) return;
        if (m.roles.cache.has(env.DISCORD_APPROVED_ROLE_ID)) return;

        const dlKick = deadlineLabel();
        // No DM at kick — the reason lives in the audit log and the user
        // was already pinged twice in the verify channel before this point.
        await m.kick(
          `Website verify not completed within ${dlKick} — rejoin when ready.`,
        );
      } catch (e) {
        console.error(`[join-gate] Deadline kick failed for ${userId}:`, e);
      }
    })();
  }, ROVER_VERIFY_DEADLINE_MS);

  kickTimers.set(member.id, timeout);
}
