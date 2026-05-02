import { Client, EmbedBuilder, type GuildMember } from "discord.js";

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
 * Instant DM + reminder before deadline + kick if verification not completed in time.
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

  try {
    const embed = new EmbedBuilder()
      .setColor(0xf59e0b)
      .setTitle(`⏱️ You have ${dl} to verify`)
      .setDescription(
        `Welcome to **VFL**. Open **[Click to verify](${verifyUrl})** and sign in with **Discord**, then **Roblox**, within **${dl}** or you will be **removed** automatically.`,
      )
      .addFields({
        name: "What to do",
        value: `Use the link above on the VFL website (works on mobile). You’ll get another DM with **${rem} left** if you’re not verified yet. If you’re stuck, open a ticket or ask staff — the timer does not pause.`,
      })
      .setFooter({ text: "VFL Bot" })
      .setTimestamp();

    await member.send({ embeds: [embed] });
  } catch {
    console.warn(
      `[join-gate] Could not DM ${member.user.tag} (${member.id}) — DMs may be closed; kick timer still applies.`,
    );
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
          .setFooter({ text: "VFL Bot" })
          .setTimestamp();
        await m.send({ embeds: [remindEmbed] });
      } catch {
        console.warn(
          `[join-gate] Could not send reminder DM to ${userId} (DMs closed or fetch failed).`,
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
        try {
          const kickDm = new EmbedBuilder()
            .setColor(0xdc2626)
            .setTitle("You were removed from VFL")
            .setDescription(
              `You did not finish **[Click to verify](${verifyUrl})** within **${dlKick}** after joining, so you have been **removed** from the server.`,
            )
            .addFields({
              name: "What’s next",
              value:
                "You can **rejoin** when you’re ready and verify right away on the site. If something blocked you (login, DMs, etc.), fix it first then try again.",
            })
            .setFooter({ text: "VFL Bot" })
            .setTimestamp();
          await m.send({ embeds: [kickDm] });
        } catch {
          console.warn(
            `[join-gate] Could not send kick notice DM to ${userId} — kicking anyway.`,
          );
        }

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
