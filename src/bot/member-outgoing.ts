import {
  AuditLogEvent,
  EmbedBuilder,
  type Guild,
  type GuildAuditLogsEntry,
  type User,
} from "discord.js";

import { env } from "@/bot/config";
import { supabaseAdmin } from "@/lib/supabase-admin";

export type MemberOutgoingReason = "banned" | "kicked" | "left_voluntarily";

/** Call once on ClientReady so production logs show if leave/kick posts are actually enabled. */
export function logMemberOutgoingStartup(): void {
  const on = Boolean(env.DISCORD_MEMBER_OUTGOING_CHANNEL_ID?.trim());
  if (on) {
    console.log(
      "[outgoing] Member leave / kick / ban log: ENABLED (channel id configured).",
    );
  } else {
    console.warn(
      "[outgoing] Member leave / kick / ban log: DISABLED — set DISCORD_MEMBER_OUTGOING_CHANNEL_ID in Railway (or .env). Blank .env.local on the host means only platform env vars apply.",
    );
  }
}

function userDisplayForEmbed(user: User): string {
  const uname = user.username ?? "unknown";
  const disc = user.discriminator;
  const legacyTag =
    disc && disc !== "0" ? `${uname}#${disc}` : `@${uname}`;
  return `${user} (${legacyTag})`;
}

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
        `**Member:** ${userDisplayForEmbed(user)}`,
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
    if (!channel?.isTextBased()) {
      console.error(
        "[outgoing] channel is not text-based or missing:",
        channelId,
      );
      return;
    }
    await channel.send({ embeds: [embed] });
    console.log("[outgoing] posted", reason, user.id);
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

function auditEntryKickMatchesUser(
  entry: GuildAuditLogsEntry,
  uid: string,
): boolean {
  const actionNum = Number(entry.action);
  if (
    actionNum !== AuditLogEvent.MemberKick &&
    actionNum !== 20
  ) {
    return false;
  }
  if (entry.targetId != null && String(entry.targetId) === uid) return true;
  const t = entry.target;
  if (t && typeof t === "object" && "id" in t && t.id != null) {
    if (String(t.id) === uid) return true;
  }
  return false;
}

export async function inferKickOrVoluntaryLeave(
  guild: Guild,
  userId: string,
): Promise<"kicked" | "left_voluntarily"> {
  const uid = String(userId);
  const now = Date.now();
  const maxAgeMs = 90_000;

  const scan = (entries: Iterable<GuildAuditLogsEntry>) => {
    for (const entry of entries) {
      if (!auditEntryKickMatchesUser(entry, uid)) continue;
      if (now - entry.createdTimestamp > maxAgeMs) continue;
      return "kicked" as const;
    }
    return null;
  };

  try {
    const typed = await guild.fetchAuditLogs({
      limit: 24,
      type: AuditLogEvent.MemberKick,
    });
    const hit = scan(typed.entries.values());
    if (hit) return hit;

    const broad = await guild.fetchAuditLogs({ limit: 48 });
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
  const ch = env.DISCORD_MEMBER_OUTGOING_CHANNEL_ID?.trim();
  if (!ch) {
    console.warn("[outgoing] skip leave log — no DISCORD_MEMBER_OUTGOING_CHANNEL_ID");
    return;
  }

  console.log("[outgoing] member remove → will classify after delay:", user.id);

  // Ban list + audit entries can lag the gateway member-remove event.
  await sleep(4000);

  if (await isUserCurrentlyBanned(guild, user.id)) {
    console.log("[outgoing] user appears banned — skipping leave duplicate (ban handler posts)");
    return;
  }

  let sub: "kicked" | "left_voluntarily" = "left_voluntarily";
  for (let attempt = 0; attempt < 3; attempt++) {
    sub = await inferKickOrVoluntaryLeave(guild, user.id);
    if (sub === "kicked") break;
    if (attempt < 2) await sleep(2000);
  }
  console.log("[outgoing] classified non-ban leave as:", sub, user.id);

  await postMemberOutgoing(guild, user, sub);
}
