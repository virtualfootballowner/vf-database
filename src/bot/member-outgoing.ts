import {
  EmbedBuilder,
  type Guild,
  type User,
} from "discord.js";
import { AuditLogEvent } from "discord-api-types/v10";

import { env } from "@/bot/config";
import { supabaseAdmin } from "@/lib/supabase-admin";

export type MemberOutgoingReason = "banned" | "kicked" | "left_voluntarily";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchRobloxForDiscord(discordId: string): Promise<{
  robloxUserId: string | null;
  robloxUsername: string | null;
}> {
  try {
    const { data, error } = await supabaseAdmin
      .from("players")
      .select("roblox_user_id, roblox_username")
      .eq("discord_id", discordId)
      .maybeSingle();
    if (error || !data) {
      return {
        robloxUserId: null,
        robloxUsername: null,
      };
    }
    return {
      robloxUserId:
        data.roblox_user_id != null && String(data.roblox_user_id).trim() !== ""
          ? String(data.roblox_user_id).trim()
          : null,
      robloxUsername:
        data.roblox_username != null
          ? String(data.roblox_username).trim() || null
          : null,
    };
  } catch {
    return {
      robloxUserId: null,
      robloxUsername: null,
    };
  }
}

function reasonLabel(reason: MemberOutgoingReason): string {
  switch (reason) {
    case "banned":
      return "Banned";
    case "kicked":
      return "Kicked";
    case "left_voluntarily":
      return "Left on their own";
    default:
      return reason;
  }
}

export async function postMemberOutgoing(
  guild: Guild,
  user: User,
  reason: MemberOutgoingReason,
): Promise<void> {
  const channelId = env.DISCORD_MEMBER_OUTGOING_CHANNEL_ID;
  if (!channelId?.trim()) return;

  const linked = await fetchRobloxForDiscord(user.id);
  const robloxLine =
    linked.robloxUserId != null
      ? [
          `**Roblox user ID:** \`${linked.robloxUserId}\``,
          linked.robloxUsername
            ? `**Roblox username:** ${linked.robloxUsername}`
            : null,
        ]
          .filter(Boolean)
          .join("\n")
      : "**Roblox:** not linked in VF database (`players.discord_id`)";

  const embed = new EmbedBuilder()
    .setColor(
      reason === "banned"
        ? 0x991b1b
        : reason === "kicked"
          ? 0xb45309
          : 0x6b7280,
    )
    .setTitle("Member left the server")
    .setDescription(
      [
        `**Member:** ${user} (${user.tag})`,
        `**Discord user ID:** \`${user.id}\``,
        `**Reason:** ${reasonLabel(reason)}`,
        "",
        robloxLine,
      ].join("\n"),
    )
    .setThumbnail(user.displayAvatarURL({ size: 128 }))
    .setFooter({ text: "VFL outgoing log" })
    .setTimestamp(new Date());

  try {
    const channel = await guild.channels.fetch(channelId);
    if (!channel?.isTextBased()) return;
    await channel.send({ embeds: [embed] });
  } catch (err) {
    console.error("postMemberOutgoing: failed to send:", err);
  }
}

/** Ban events can arrive before or after member remove; use this after a short delay. */
export async function isUserCurrentlyBanned(
  guild: Guild,
  userId: string,
): Promise<boolean> {
  try {
    await guild.bans.fetch(userId);
    return true;
  } catch {
    return false;
  }
}

export async function inferKickOrVoluntaryLeave(
  guild: Guild,
  userId: string,
): Promise<"kicked" | "left_voluntarily"> {
  const uid = String(userId);
  const isKickEntry = (
    entry: { action: number; targetId: string | null; createdTimestamp: number },
  ) => {
    if (entry.action !== AuditLogEvent.MemberKick) return false;
    const tid = entry.targetId != null ? String(entry.targetId) : null;
    if (tid !== uid) return false;
    return true;
  };

  const now = Date.now();
  const maxAgeMs = 45_000;

  const scan = (entries: Iterable<{
    action: number;
    targetId: string | null;
    createdTimestamp: number;
  }>) => {
    for (const entry of entries) {
      if (!isKickEntry(entry)) continue;
      if (now - entry.createdTimestamp > maxAgeMs) continue;
      return "kicked" as const;
    }
    return null;
  };

  try {
    const typed = await guild.fetchAuditLogs({
      limit: 20,
      type: AuditLogEvent.MemberKick,
    });
    const hit = scan(typed.entries.values());
    if (hit) return hit;

    // Fallback: untyped fetch (some API paths return fuller ordering)
    const broad = await guild.fetchAuditLogs({ limit: 30 });
    const hit2 = scan(broad.entries.values());
    if (hit2) return hit2;
  } catch (err) {
    console.error("inferKickOrVoluntaryLeave: audit log failed:", err);
  }
  return "left_voluntarily";
}

/**
 * After member remove, wait briefly so ban entry exists, then classify leave.
 * Does not post when the departure was due to a ban (`GuildBanAdd` handles that).
 */
export async function handleMemberRemoveOutgoing(
  guild: Guild,
  user: User,
): Promise<void> {
  if (!env.DISCORD_MEMBER_OUTGOING_CHANNEL_ID?.trim()) return;

  await sleep(2500);

  if (await isUserCurrentlyBanned(guild, user.id)) {
    return;
  }

  const sub = await inferKickOrVoluntaryLeave(guild, user.id);
  await postMemberOutgoing(guild, user, sub);
}
