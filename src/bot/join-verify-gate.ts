import { Client, EmbedBuilder, type GuildMember } from "discord.js";

import { env } from "@/bot/config";

const ROVER_VERIFY_DEADLINE_MS = 10 * 60 * 1000;

const kickTimers = new Map<string, NodeJS.Timeout>();

export function cancelRoverVerifyDeadline(userId: string): void {
  const t = kickTimers.get(userId);
  if (t) {
    clearTimeout(t);
    kickTimers.delete(userId);
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
 * Instant DM + 10m deadline to obtain Rover verified role, else kick.
 */
export async function handleMemberJoinVerifyGate(
  client: Client,
  member: GuildMember,
): Promise<void> {
  if (!needsRoverGate(member)) return;

  cancelRoverVerifyDeadline(member.id);

  try {
    const embed = new EmbedBuilder()
      .setColor(0xf59e0b)
      .setTitle("⏱️ You have 10 minutes to verify")
      .setDescription(
        "Welcome to **VFL**. Complete **Rover** Roblox verification in this server within **10 minutes** or you will be **removed** automatically.",
      )
      .addFields({
        name: "What to do",
        value:
          "Use the server’s verification / Rover flow now so your Roblox account is linked. If you’re stuck, open a ticket or ask staff — but the timer does not pause.",
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
  const timeout = setTimeout(() => {
    void (async () => {
      kickTimers.delete(userId);
      try {
        const guild = await client.guilds.fetch(env.DISCORD_GUILD_ID);
        const m = await guild.members.fetch(userId).catch(() => null);
        if (!m) return;
        if (m.roles.cache.has(env.DISCORD_ROVER_VERIFIED_ROLE_ID)) return;
        if (m.roles.cache.has(env.DISCORD_APPROVED_ROLE_ID)) return;
        await m.kick(
          "Rover verification not completed within 10 minutes — rejoin when ready.",
        );
      } catch (e) {
        console.error(`[join-gate] Deadline kick failed for ${userId}:`, e);
      }
    })();
  }, ROVER_VERIFY_DEADLINE_MS);

  kickTimers.set(member.id, timeout);
}
