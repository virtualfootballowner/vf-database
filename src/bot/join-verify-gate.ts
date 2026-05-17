import { Client, type GuildMember } from "discord.js";

import { env } from "@/bot/config";
import { createBotSupabase } from "@/bot/stats-queries";
import {
  describeBanForUi,
  isDiscordBanActive,
} from "@/lib/players/discord-ban";

/**
 * Join-time verification gate.
 *
 * Discord's Developer Policy bans unsolicited DMs from bots. Since *we* are now
 * the verify bot (no third-party RoVer), there is no longer any reason to cold
 * DM new joiners — they discover the website link from the pinned `/postverify`
 * card in the verify channel. This file only manages the **silent** auto-kick
 * timer; the user is never DM'd before, during, or after the kick.
 */

const ROVER_VERIFY_DEADLINE_MINUTES: number = 10;
const ROVER_VERIFY_DEADLINE_MS = ROVER_VERIFY_DEADLINE_MINUTES * 60 * 1000;

function deadlineLabel(): string {
  return ROVER_VERIFY_DEADLINE_MINUTES === 1
    ? "1 minute"
    : `${ROVER_VERIFY_DEADLINE_MINUTES} minutes`;
}

const kickTimers = new Map<string, NodeJS.Timeout>();

/**
 * Linked players who are still marked banned in the DB must not remain in the
 * league guild (covers temp-ban bookkeeping and Discord/DB drift).
 */
export async function handleLeagueDiscordBanJoinGate(
  member: GuildMember,
): Promise<boolean> {
  if (member.user.bot) return false;
  if (member.guild.id !== env.DISCORD_GUILD_ID) return false;

  const supabase = createBotSupabase();
  const { data, error } = await supabase
    .from("players")
    .select("discord_banned_at, discord_banned_until")
    .eq("discord_id", member.id)
    .maybeSingle();

  if (error) {
    console.error("[ban-join-gate] player lookup:", error);
    return false;
  }

  const row = data as {
    discord_banned_at: string | null;
    discord_banned_until: string | null;
  } | null;

  if (!isDiscordBanActive(row)) return false;

  const desc = describeBanForUi(row);
  const detail = desc.isPermanent
    ? "permanent league ban"
    : desc.untilLabel
      ? `banned until ${desc.untilLabel}`
      : "league ban in effect";

  try {
    await member.kick(`VF league Discord — ${detail}.`);
  } catch (e) {
    console.error(`[ban-join-gate] kick failed for ${member.id}:`, e);
  }
  return true;
}

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
 * Schedule a silent kick for any new joiner who hasn't picked up the verified
 * role within the deadline. The pinned `/postverify` card in the verify channel
 * is how they learn what to do — we never DM them.
 */
export async function handleMemberJoinVerifyGate(
  client: Client,
  member: GuildMember,
): Promise<void> {
  if (!needsRoverGate(member)) return;

  cancelRoverVerifyDeadline(member.id);

  const userId = member.id;
  const dlKick = deadlineLabel();

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
          `Website verify not completed within ${dlKick} — rejoin when ready.`,
        );
      } catch (e) {
        console.error(`[join-gate] Deadline kick failed for ${userId}:`, e);
      }
    })();
  }, ROVER_VERIFY_DEADLINE_MS);

  kickTimers.set(member.id, timeout);
}
