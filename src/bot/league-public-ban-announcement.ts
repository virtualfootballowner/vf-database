import type { Client, GuildBan } from "discord.js";
import { EmbedBuilder } from "discord.js";

import { env } from "@/bot/config";
import { formatBailAmountForDisplay } from "@/lib/players/format-ban-bail";
import { createBotSupabase } from "@/bot/stats-queries";
import { getRobloxHeadshotsForBot } from "@/lib/roblox";
import {
  describeBanForUi,
  isDiscordBanActive,
} from "@/lib/players/discord-ban";

/**
 * Brief delay so `/ban` can finish writing `discord_banned_until` before we read
 * the row (GuildBanAdd runs around the same time as that write).
 */
const ANNOUNCE_DELAY_MS = 2000;

export function scheduleLeaguePublicBanAnnouncement(
  client: Client,
  ban: GuildBan,
): void {
  const channelId = env.DISCORD_PUBLIC_BAN_LOG_CHANNEL_ID?.trim();
  if (!channelId) return;
  if (ban.guild.id !== env.DISCORD_GUILD_ID) return;

  const user = ban.user;
  const auditReason = ban.reason?.trim() ?? null;

  setTimeout(() => {
    void postLeaguePublicBanAnnouncement(
      client,
      channelId,
      user.id,
      user.tag,
      auditReason,
    );
  }, ANNOUNCE_DELAY_MS);
}

async function postLeaguePublicBanAnnouncement(
  client: Client,
  channelId: string,
  discordUserId: string,
  discordTag: string,
  auditReason: string | null,
): Promise<void> {
  try {
    const supabase = createBotSupabase();
    const { data: row, error } = await supabase
      .from("players")
      .select(
        "roblox_username, roblox_user_id, discord_banned_at, discord_banned_until, discord_ban_reason, discord_ban_bail_amount",
      )
      .eq("discord_id", discordUserId)
      .maybeSingle();

    if (error) console.error("[public-ban] player lookup:", error);

    const siteBase = env.VFL_SITE_URL.replace(/\/$/, "");

    const player = row as {
      roblox_username: string | null;
      roblox_user_id: string | null;
      discord_banned_at: string | null;
      discord_banned_until: string | null;
      discord_ban_reason: string | null;
      discord_ban_bail_amount: number | string | null;
    } | null;

    const banRow = {
      discord_banned_at: player?.discord_banned_at ?? null,
      discord_banned_until: player?.discord_banned_until ?? null,
    };

    const banUi = describeBanForUi(banRow);
    let durationValue: string;
    if (!player) {
      durationValue =
        "*No VF player row linked to this Discord — duration may still apply on Discord.*";
    } else if (!isDiscordBanActive(banRow)) {
      durationValue = `*Ban flags are syncing — check [players](${siteBase}/players) if this looks wrong.*`;
    } else if (banUi.isPermanent) {
      durationValue = "**Permanent** (until staff unban).";
    } else if (banUi.untilLabel) {
      const t = new Date(banUi.untilLabel).getTime();
      const unix = Number.isFinite(t) ? Math.floor(t / 1000) : null;
      durationValue = unix
        ? `**Temporary** — lifts <t:${unix}:F> · <t:${unix}:R>`
        : `**Temporary** — lifts \`${banUi.untilLabel}\``;
    } else {
      durationValue = "**Temporary**";
    }

    let thumbUrl: string | null = null;
    const robloxId = player?.roblox_user_id?.trim();
    if (robloxId) {
      const map = await getRobloxHeadshotsForBot([robloxId], "180x180");
      thumbUrl = map.get(robloxId) ?? null;
    }

    const robloxName = player?.roblox_username?.trim();
    const profileUrl =
      robloxName && robloxId
        ? `${siteBase}/players/${encodeURIComponent(robloxName)}`
        : null;

    const reasonText =
      player?.discord_ban_reason?.trim() || auditReason || "*No reason provided*";

    const bailNum = Number(player?.discord_ban_bail_amount);
    const bailField =
      Number.isFinite(bailNum) && bailNum > 0
        ? `**${formatBailAmountForDisplay(bailNum)}** — join the league server & open a ticket to discuss or pay (see staff).`
        : null;

    const embed = new EmbedBuilder()
      .setColor(0x991b1b)
      .setTitle("League Discord · ban")
      .setDescription(
        [
          `**Discord** · \`${discordTag}\` · <@${discordUserId}>`,
          robloxName
            ? `**Roblox** · **${robloxName}**${profileUrl ? ` · [VF profile](${profileUrl})` : ""}`
            : "**Roblox** · *not linked on VF roster*",
        ].join("\n"),
      )
      .addFields(
        { name: "Duration", value: durationValue, inline: false },
        ...(bailField
          ? [{ name: "Bail", value: bailField, inline: false }]
          : []),
        {
          name: "Reason",
          value: reasonText.length > 900 ? `${reasonText.slice(0, 897)}…` : reasonText,
          inline: false,
        },
      )
      .setTimestamp(new Date());

    if (thumbUrl) embed.setThumbnail(thumbUrl);

    const ch = await client.channels.fetch(channelId);
    if (!ch?.isTextBased() || !ch.isSendable()) {
      console.warn("[public-ban] channel not sendable:", channelId);
      return;
    }

    await ch.send({
      embeds: [embed],
      allowedMentions: { parse: [] },
    });
  } catch (e) {
    console.error("[public-ban] announce failed:", e);
  }
}
