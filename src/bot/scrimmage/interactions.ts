/**
 * Single dispatch surface for every scrimmage button + modal interaction.
 * Called from `src/bot/index.ts` so `index.ts` doesn't grow a huge prefix
 * ladder for the FACEIT system.
 *
 * All scrimmage custom IDs use the `vfl:scr:` namespace.
 */

import type { ButtonInteraction, ModalSubmitInteraction } from "discord.js";

import { handlePickButton, SCR_BTN_PICK_PREFIX } from "@/bot/scrimmage/draft";
import {
  handleConfirmButton,
  handleDisputeButton,
  SCR_BTN_CONFIRM_PREFIX,
  SCR_BTN_DISPUTE_PREFIX,
} from "@/bot/scrimmage/result";
import {
  handleJoinButton,
  handleLeaveButton,
  handlePositionModal,
  SCR_BTN_JOIN,
  SCR_BTN_LEAVE,
  SCR_MODAL_POSITION,
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

  if (id === SCR_BTN_JOIN) {
    await handleJoinButton(interaction);
    return true;
  }
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
  if (id.startsWith(SCR_BTN_CONFIRM_PREFIX)) {
    const matchId = id.slice(SCR_BTN_CONFIRM_PREFIX.length);
    await handleConfirmButton(interaction, matchId);
    return true;
  }
  if (id.startsWith(SCR_BTN_DISPUTE_PREFIX)) {
    const matchId = id.slice(SCR_BTN_DISPUTE_PREFIX.length);
    await handleDisputeButton(interaction, matchId);
    return true;
  }

  return false;
}

/**
 * Dispatch a modal submit whose customId starts with `vfl:scr:`. Returns
 * `true` if matched. Currently only the position modal is in use.
 */
export async function handleScrimmageModal(
  interaction: ModalSubmitInteraction,
): Promise<boolean> {
  const id = interaction.customId;
  if (!isScrimmageCustomId(id)) return false;

  if (id === SCR_MODAL_POSITION) {
    await handlePositionModal(interaction);
    return true;
  }

  return false;
}
