/**
 * Scrimmage admin / lifecycle helpers.
 *
 * The captain-driven /scrimmage report + confirm/dispute flow has been
 * removed in favour of fully automated finalization driven by Roblox
 * `match_end` events (see src/lib/scrimmage/auto-finalize.ts and
 * POST /api/scrimmage/events). The match is the single source of truth
 * for scores and the API edits the lobby card itself.
 *
 * This module now only exposes /scrimmage void as the admin escape
 * hatch when an event pipeline outage leaves a match stuck `live`.
 */

import {
  EmbedBuilder,
  MessageFlags,
  type ChatInputCommandInteraction,
  type Client,
} from "discord.js";

import { createBotSupabase } from "@/bot/stats-queries";
import {
  fetchScrimmageMatchByCode,
  updateScrimmageMatchStatus,
} from "@/bot/scrimmage/db";
import { clearActiveLobby, getActiveLobby } from "@/bot/scrimmage/state";
import { isScrimmageAdmin } from "@/bot/scrimmage/permissions";

const COLOR_NEUTRAL = 0x6b7280;

/* ------------------------------------------------------------------ */
/*  /scrimmage void <code>                                            */
/* ------------------------------------------------------------------ */

export async function handleScrimmageVoid(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  if (!isScrimmageAdmin(interaction)) {
    await interaction.reply({
      flags: MessageFlags.Ephemeral,
      content:
        "You need **Administrator** (or be the server owner) to void a scrimmage.",
    });
    return;
  }

  const matchCode = interaction.options.getString("code", true).trim();
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const supabase = createBotSupabase();
  const match = await fetchScrimmageMatchByCode(supabase, matchCode).catch(
    (err) => {
      console.error("[scrimmage] fetchScrimmageMatchByCode failed:", err);
      return null;
    },
  );
  if (!match) {
    await interaction.editReply({
      content: `No scrimmage with code \`${matchCode}\`.`,
    });
    return;
  }
  if (match.status === "completed") {
    await interaction.editReply({
      content: `Match \`${matchCode}\` is already completed and ELO has been applied. Voiding a completed match isn't supported.`,
    });
    return;
  }
  if (match.status === "voided" || match.status === "cancelled") {
    await interaction.editReply({
      content: `Match \`${matchCode}\` is already \`${match.status}\`.`,
    });
    return;
  }

  try {
    await updateScrimmageMatchStatus(supabase, match.id, "voided");
  } catch (err) {
    console.error("[scrimmage] void status update failed:", err);
    await interaction.editReply({
      content: `Couldn’t void: ${err instanceof Error ? err.message : "unknown error"}`,
    });
    return;
  }

  const lobby = getActiveLobby();
  if (lobby && lobby.matchId === match.id) {
    clearActiveLobby();
  }

  // Replace the lobby card so the queue/draft/live embed doesn't sit
  // around forever after a void. Best-effort — failure isn't fatal.
  await editLobbyCardToFinalState({
    client: interaction.client,
    channelId: match.lobby_channel_id,
    messageId: match.lobby_message_id,
    embed: new EmbedBuilder()
      .setColor(COLOR_NEUTRAL)
      .setTitle(`🛑 Scrimmage voided · ${matchCode}`)
      .setDescription(
        [
          `Voided by <@${interaction.user.id}>.`,
          "No ELO applied. Run **`/scrimmage start`** to open a fresh lobby.",
        ].join("\n"),
      )
      .setFooter({ text: "VF FACEIT" })
      .setTimestamp(new Date()),
  });

  await interaction.editReply({
    content: `✅ Voided \`${matchCode}\` (was \`${match.status}\`). No ELO applied.`,
  });
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

/**
 * Edit the original `#scrimmage-lobby` card (queue/draft/ready/live) to a
 * terminal embed. Used by /scrimmage void so the old live roster doesn't
 * linger after an admin action.
 *
 * Fully best-effort — if the channel is gone, the message is gone, or we
 * lack edit perms, we just log and move on. The DB state is canonical.
 */
async function editLobbyCardToFinalState(args: {
  client: Client;
  channelId: string | null;
  messageId: string | null;
  embed: EmbedBuilder;
}): Promise<void> {
  if (!args.channelId || !args.messageId) return;
  try {
    const channel = await args.client.channels.fetch(args.channelId);
    if (!channel || !channel.isTextBased() || !("messages" in channel)) return;
    const msg = await channel.messages
      .fetch(args.messageId)
      .catch(() => null);
    if (!msg) return;
    await msg.edit({
      content: "",
      embeds: [args.embed],
      components: [],
    });
  } catch (err) {
    console.error("[scrimmage] editLobbyCardToFinalState failed:", err);
  }
}
