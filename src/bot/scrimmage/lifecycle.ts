/**
 * Lifecycle helpers shared across all scrimmage phases.
 *
 * Lives in its own file so that queue → draft → ready → result can all
 * use these without forming an import cycle. (queue.ts owns the start-of-
 * lobby flow; ready.ts and result.ts also need to cancel/cleanup, hence
 * the shared module.)
 */

import { EmbedBuilder } from "discord.js";

import { createBotSupabase } from "@/bot/stats-queries";
import { updateScrimmageMatchStatus } from "@/bot/scrimmage/db";
import {
  clearActiveLobby,
  clearTimers,
  type ActiveLobby,
} from "@/bot/scrimmage/state";

const COLOR_NEUTRAL = 0x6b7280;

/**
 * Tear down a lobby cleanly:
 *  - Clear all in-memory timers
 *  - Mark the DB row as `cancelled`
 *  - Edit the lobby card to a final cancelled state (best-effort)
 *  - Wipe the active-lobby singleton
 */
export async function cancelLobby(
  lobby: ActiveLobby,
  reason: string,
): Promise<void> {
  clearTimers(lobby);

  try {
    await updateScrimmageMatchStatus(
      createBotSupabase(),
      lobby.matchId,
      "cancelled",
    );
  } catch (err) {
    console.error("[scrimmage] cancelLobby DB update failed:", err);
  }

  try {
    const msg = await lobby.channel.messages
      .fetch(lobby.messageId)
      .catch(() => null);
    if (msg) {
      await msg.edit({
        content: "",
        embeds: [
          new EmbedBuilder()
            .setColor(COLOR_NEUTRAL)
            .setTitle(`🛑 Scrimmage cancelled (${lobby.matchCode})`)
            .setDescription(`Reason: ${reason}`)
            .setFooter({ text: "VF FACEIT" })
            .setTimestamp(new Date()),
        ],
        components: [],
      });
    }
  } catch (err) {
    console.error("[scrimmage] cancelLobby card edit failed:", err);
  }

  clearActiveLobby();
}
