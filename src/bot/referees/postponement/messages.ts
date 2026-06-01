import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
} from "discord.js";

import { discordTeamLabel } from "@/bot/discord-team-flags";
import { buildAssignmentKickoffLabel } from "@/bot/referees/assignments";
import type { RefereeAssignmentRow } from "@/bot/referees/queries";
import {
  REFEREE_POSTPONE_DROP_PREFIX,
  REFEREE_POSTPONE_KEEP_PREFIX,
  type RefereeAssignmentSlot,
} from "@/lib/referees/discord-constants";

function slotLabel(slot: RefereeAssignmentSlot): string {
  return slot === "main" ? "main referee" : "linesman";
}

export function buildPostponementRefereeDmEmbed(
  assignment: RefereeAssignmentRow,
  slot: RefereeAssignmentSlot,
  newScheduledAt: string,
  options?: { homeSlug?: string | null; awaySlug?: string | null },
): EmbedBuilder {
  const matchLine = `${discordTeamLabel(assignment.home_team_name, options?.homeSlug)} vs ${discordTeamLabel(assignment.away_team_name, options?.awaySlug)}`;

  return new EmbedBuilder()
    .setColor(0xf59e0b)
    .setTitle("Fixture postponed")
    .setDescription(
      [
        `You are assigned as **${slotLabel(slot)}** for:`,
        "",
        matchLine,
        "",
        `**New kickoff:** ${buildAssignmentKickoffLabel(newScheduledAt)}`,
        "",
        "Can you still officiate at the new time?",
      ].join("\n"),
    )
    .setFooter({ text: `${assignment.competition} · S${assignment.season}` })
    .setTimestamp(new Date());
}

export function buildPostponementRefereeActionRow(
  responseId: string,
): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`${REFEREE_POSTPONE_KEEP_PREFIX}${responseId}`)
      .setLabel("I can still ref")
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(`${REFEREE_POSTPONE_DROP_PREFIX}${responseId}`)
      .setLabel("I can't make it")
      .setStyle(ButtonStyle.Danger),
  );
}
