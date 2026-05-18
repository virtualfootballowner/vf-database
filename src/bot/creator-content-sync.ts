import {
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
} from "discord.js";

import { createBotSupabase } from "@/bot/stats-queries";
import {
  resolveApifyTiktokActors,
  resolveApifyYoutubeActors,
} from "@/lib/creator-onboard/apify-video-views";
import { syncPostedVideoViewsWithSupabase } from "@/lib/creator-onboard/sync-posted-video-views";

export const updateContentCommand = new SlashCommandBuilder()
  .setName("update-content")
  .setDescription(
    "Refresh VF Create directory views (YouTube + TikTok via Apify; same as daily cron)",
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .toJSON();

export async function handleUpdateContentCommand(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  if (!interaction.guild) {
    await interaction.reply({
      flags: MessageFlags.Ephemeral,
      content: "Use this command inside the server.",
    });
    return;
  }

  if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
    await interaction.reply({
      flags: MessageFlags.Ephemeral,
      content: "You need **Manage Server** to refresh directory metrics.",
    });
    return;
  }

  const token = process.env.APIFY_API_TOKEN?.trim();
  if (!token) {
    await interaction.reply({
      flags: MessageFlags.Ephemeral,
      content:
        "Missing **APIFY_API_TOKEN** on the bot host (Railway). Add it next to `SUPABASE_*`.",
    });
    return;
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  try {
    const supabase = createBotSupabase();
    const yt = resolveApifyYoutubeActors();
    const tt = resolveApifyTiktokActors();

    const result = await syncPostedVideoViewsWithSupabase({
      supabase,
      apifyToken: token,
      youtubeActorId: yt.primary,
      youtubeFallbackActorId: yt.fallback,
      tiktokActorId: tt.primary,
      tiktokFallbackActorId: tt.fallback,
    });

    const lines = [
      "**VF Create · directory metrics**",
      `Creator apps (with posts): **${result.applicationsConsidered}**`,
      `Applications updated: **${result.applicationsUpdated}**`,
      `YouTube URLs (unique): **${result.youtubeUrls}**`,
      `TikTok URLs (unique): **${result.tiktokUrls}**`,
      `Other URLs (skipped): **${result.otherUrls}**`,
    ];
    if (result.youtubeError) {
      lines.push(`YouTube: ${result.youtubeError.slice(0, 350)}`);
    }
    if (result.tiktokError) {
      lines.push(`TikTok: ${result.tiktokError.slice(0, 350)}`);
    }

    await interaction.editReply({
      content: lines.join("\n").slice(0, 2000),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Sync failed";
    console.error("[bot] /update-content:", e);
    await interaction.editReply({
      content: `Could not finish sync: ${msg.slice(0, 500)}`,
    });
  }
}
