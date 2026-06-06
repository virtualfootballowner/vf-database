import {
  MessageFlags,
  PermissionFlagsBits,
  type ChatInputCommandInteraction,
} from "discord.js";

import { env } from "@/bot/config";
import {
  ASSIST_SLOT_NAMES,
  collectPlayerStatsFromSlots,
  RED_CARD_SLOT_NAMES,
  SCORER_SLOT_NAMES,
  YELLOW_CARD_SLOT_NAMES,
} from "@/bot/results/slots";
import { parseScoreline, parseSinglePlayer } from "@/bot/results/parse";
import {
  applyMatchResult,
  fetchMatchByRobloxId,
} from "@/bot/results/queries";
import { postLeagueResultsDiscord } from "@/lib/league/post-results-discord";
import { isWorldCupFixtureId } from "@/lib/league/world-cup-results";
import { createBotSupabase } from "@/bot/stats-queries";

function formatErr(err: unknown): string {
  if (err instanceof Error && err.message.trim()) return err.message.trim();
  return "Unknown error";
}

export async function handleResultsCommand(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  if (!interaction.guild) {
    await interaction.reply({
      flags: MessageFlags.Ephemeral,
      content: "Run this command inside the server.",
    });
    return;
  }

  if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageRoles)) {
    await interaction.reply({
      flags: MessageFlags.Ephemeral,
      content: "You need the **Manage Roles** permission to log match results.",
    });
    return;
  }

  const matchIdRaw = interaction.options.getString("match_id", true);
  const scorelineRaw = interaction.options.getString("scoreline", true);
  const motmRaw = interaction.options.getString("motm");

  const scoreline = parseScoreline(scorelineRaw);
  if (!scoreline) {
    await interaction.reply({
      flags: MessageFlags.Ephemeral,
      content:
        "Invalid **scoreline**. Use home-away format like `2-1` or `0-0`.",
    });
    return;
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  try {
    const supabase = createBotSupabase();
    const match = await fetchMatchByRobloxId(supabase, matchIdRaw);
    if (!match) {
      await interaction.editReply({
        content:
          `No match found for ID \`${matchIdRaw.trim()}\`. Example: \`S3-WC-G-B-02\`.`,
      });
      return;
    }

    const applied = await applyMatchResult(supabase, {
      match,
      homeScore: scoreline.home,
      awayScore: scoreline.away,
      scorers: collectPlayerStatsFromSlots(interaction, SCORER_SLOT_NAMES),
      assists: collectPlayerStatsFromSlots(interaction, ASSIST_SLOT_NAMES),
      motm: parseSinglePlayer(motmRaw),
      yellowCards: collectPlayerStatsFromSlots(interaction, YELLOW_CARD_SLOT_NAMES),
      redCards: collectPlayerStatsFromSlots(interaction, RED_CARD_SLOT_NAMES),
      submittedByDiscordId: interaction.user.id,
    });

    const warnBlock =
      applied.warnings.length > 0
        ? `\n\n**Notes**\n${applied.warnings.slice(0, 8).join("\n")}`
        : "";

    const code = match.roblox_match_id.trim();
    let discordNote = "";
    if (isWorldCupFixtureId(code)) {
      const posted = await postLeagueResultsDiscord(supabase, code, {
        submittedByTag: interaction.user.tag,
        channelId: env.DISCORD_RESULTS_CHANNEL_ID,
      });
      if (posted.ok && "messageId" in posted && posted.messageId) {
        discordNote = ` Posted to <#${posted.channelId}>.`;
      } else if (posted.ok && "skipped" in posted && posted.skipped) {
        discordNote = ` Discord: ${posted.reason}`;
      } else if (!posted.ok) {
        discordNote = ` Discord post failed: ${posted.reason}`;
      }
    } else {
      discordNote =
        " Saved to DB only — only **S3-WC-*** fixtures are posted to #wc-results.";
    }

    await interaction.editReply({
      content:
        `✅ Logged **${match.home_name} ${scoreline.home}–${scoreline.away} ${match.away_name}** (\`${code}\`).${discordNote}${warnBlock}`,
    });
  } catch (err) {
    console.error("/results failed:", err);
    await interaction.editReply({
      content: `Could not log result: ${formatErr(err)}`,
    });
  }
}
