/**
 * Single dispatch surface for every scrimmage button + select-menu
 * interaction. Called from `src/bot/index.ts` so `index.ts` doesn't grow
 * a huge prefix ladder for the FACEIT system.
 *
 * All scrimmage custom IDs use the `vfl:scr:` namespace.
 */

import type {
  ButtonInteraction,
  StringSelectMenuInteraction,
} from "discord.js";

import { handlePickButton, SCR_BTN_PICK_PREFIX } from "@/bot/scrimmage/draft";
import {
  handleJoinSelect,
  handleLeaveButton,
  SCR_BTN_LEAVE,
  SCR_SELECT_JOIN,
} from "@/bot/scrimmage/queue";
import { handleReadyButton, SCR_BTN_READY } from "@/bot/scrimmage/ready";

export const SCR_NAMESPACE = "vfl:scr:";

export function isScrimmageCustomId(customId: string): boolean {
  return customId.startsWith(SCR_NAMESPACE);
}

/**
 * Dispatch a button interaction whose customId starts with `vfl:scr:`.
 * Returns `true` if a handler was matched (caller should not continue).
 */
export async function handleScrimmageButton(
  interaction: ButtonInteraction,
): Promise<boolean> {
  const id = interaction.customId;
  if (!isScrimmageCustomId(id)) return false;

  if (id === SCR_BTN_LEAVE) {
    await handleLeaveButton(interaction);
    return true;
  }
  if (id === SCR_BTN_READY) {
    await handleReadyButton(interaction);
    return true;
  }
  if (id.startsWith(SCR_BTN_PICK_PREFIX)) {
    const pickedDiscordId = id.slice(SCR_BTN_PICK_PREFIX.length);
    await handlePickButton(interaction, pickedDiscordId);
    return true;
  }

  // Old confirm/dispute buttons (vfl:scr:confirm:* / vfl:scr:dispute:*)
  // are dead code as of the auto-finalize migration. We swallow them
  // silently with an ephemeral so old lobby cards don't error out if
  // someone reads back a stale message.
  if (id.startsWith("vfl:scr:confirm:") || id.startsWith("vfl:scr:dispute:")) {
    await interaction.reply({
      flags: 1 << 6,
      content:
        "Manual result confirmation has been removed — scrimmages auto-finalize from Roblox match events now.",
    });
    return true;
  }

  return false;
}

/**
 * Dispatch a string-select-menu interaction whose customId starts with
 * `vfl:scr:`. Returns `true` if matched. Currently only the position
 * picker on the queue card uses this surface.
 */
export async function handleScrimmageSelect(
  interaction: StringSelectMenuInteraction,
): Promise<boolean> {
  const id = interaction.customId;
  if (!isScrimmageCustomId(id)) return false;

  if (id === SCR_SELECT_JOIN) {
    await handleJoinSelect(interaction);
    return true;
  }

  return false;
}
