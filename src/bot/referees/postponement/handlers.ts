import { MessageFlags, type ButtonInteraction } from "discord.js";

import { applyPostponementRefereeResponse } from "@/bot/referees/postponement/notify";
import {
  fetchPostponementResponse,
  setPostponementResponseStatus,
} from "@/bot/referees/postponement/queries";
import { createBotSupabase } from "@/bot/stats-queries";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function handlePostponementRefereeButton(
  interaction: ButtonInteraction,
  responseIdRaw: string,
  action: "confirmed" | "declined",
): Promise<void> {
  const responseId = responseIdRaw.trim();
  if (!UUID_RE.test(responseId)) {
    await interaction.reply({
      flags: MessageFlags.Ephemeral,
      content: "Invalid response link.",
    });
    return;
  }

  const supabase = createBotSupabase();
  const existing = await fetchPostponementResponse(supabase, responseId);
  if (!existing) {
    await interaction.reply({
      flags: MessageFlags.Ephemeral,
      content: "This postponement check is no longer active.",
    });
    return;
  }

  if (interaction.user.id !== existing.discord_id) {
    await interaction.reply({
      flags: MessageFlags.Ephemeral,
      content: "This message was sent to a different referee.",
    });
    return;
  }

  if (existing.status !== "pending") {
    await interaction.reply({
      flags: MessageFlags.Ephemeral,
      content: "You already responded to this postponement.",
    });
    return;
  }

  const updated = await setPostponementResponseStatus(
    supabase,
    responseId,
    action,
  );
  if (!updated) {
    await interaction.reply({
      flags: MessageFlags.Ephemeral,
      content: "Could not save your response. Try again.",
    });
    return;
  }

  await interaction.deferUpdate();
  await interaction.message.edit({ components: [] }).catch(() => {});

  await applyPostponementRefereeResponse(interaction.client, updated, action);

  const ack =
    action === "confirmed"
      ? "Thanks — you're still assigned. The fixture post will show the **new kickoff** once everyone responds."
      : "You've been removed from that slot. Other referees will be asked to claim the **postponed** fixture.";

  try {
    await interaction.followUp({
      flags: MessageFlags.Ephemeral,
      content: ack,
    });
  } catch {
    /* ignore */
  }
}

export async function handleRefereePostponeKeepButton(
  interaction: ButtonInteraction,
  responseIdRaw: string,
): Promise<void> {
  await handlePostponementRefereeButton(interaction, responseIdRaw, "confirmed");
}

export async function handleRefereePostponeDropButton(
  interaction: ButtonInteraction,
  responseIdRaw: string,
): Promise<void> {
  await handlePostponementRefereeButton(interaction, responseIdRaw, "declined");
}
