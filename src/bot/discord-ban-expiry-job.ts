import type { Client } from "discord.js";

import { env } from "@/bot/config";
import { clearPlayerDiscordBanFromGuild } from "@/bot/player-discord-ban-sync";
import { createBotSupabase } from "@/bot/stats-queries";

const TICK_MS = 5 * 60 * 1000;

function discordErrorCode(error: unknown): number | null {
  if (!error || typeof error !== "object") return null;
  if (!("code" in error)) return null;
  const c = (error as { code: unknown }).code;
  return typeof c === "number" ? c : null;
}

export async function runDiscordBanExpirySweep(client: Client): Promise<void> {
  const guildId = env.DISCORD_GUILD_ID?.trim();
  if (!guildId) return;

  const supabase = createBotSupabase();
  const nowIso = new Date().toISOString();

  const { data, error } = await supabase
    .from("players")
    .select("discord_id")
    .not("discord_id", "is", null)
    .not("discord_banned_at", "is", null)
    .not("discord_banned_until", "is", null)
    .lte("discord_banned_until", nowIso);

  if (error) {
    console.error("[ban-expiry] fetch:", error);
    return;
  }

  const rows = (data ?? []) as { discord_id: string }[];
  if (rows.length === 0) return;

  const guild = await client.guilds.fetch(guildId).catch(() => null);
  if (!guild) {
    console.warn("[ban-expiry] guild not visible to bot — skipping sweep");
    return;
  }

  for (const row of rows) {
    const discordId = row.discord_id;
    try {
      await guild.members.unban(discordId, "VF: scheduled temp ban ended");
    } catch (e) {
      const code = discordErrorCode(e);
      if (code !== 10026) {
        console.error(`[ban-expiry] unban ${discordId}:`, e);
        continue;
      }
    }
    try {
      await clearPlayerDiscordBanFromGuild(supabase, discordId);
    } catch (clearErr) {
      console.error(`[ban-expiry] clear DB ${discordId}:`, clearErr);
    }
  }

  console.log(
    `[ban-expiry] sweep done · ${rows.length} expired temp ban row(s) processed`,
  );
}

export function scheduleDiscordBanExpiryJob(client: Client): void {
  void runDiscordBanExpirySweep(client).catch((e) => {
    console.error("[ban-expiry] initial run:", e);
  });

  setInterval(() => {
    void runDiscordBanExpirySweep(client).catch((e) => {
      console.error("[ban-expiry] tick:", e);
    });
  }, TICK_MS);
}
