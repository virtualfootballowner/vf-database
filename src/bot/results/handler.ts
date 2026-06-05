import {
  MessageFlags,
  PermissionFlagsBits,
  type ChatInputCommandInteraction,
  type GuildTextBasedChannel,
} from "discord.js";

import { env } from "@/bot/config";
import {
  parsePlayerStatList,
  parseScoreline,
  parseSinglePlayer,
} from "@/bot/results/parse";
import {
  applyMatchResult,
  fetchMatchByRobloxId,
} from "@/bot/results/queries";
import { buildResultsEmbed } from "@/bot/results/embed";
import { fetchTeamLogoUrl } from "@/bot/site-assets";
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
  const scorersRaw = interaction.options.getString("scorers");
  const assistsRaw = interaction.options.getString("assists");
  const motmRaw = interaction.options.getString("motm");
  const yellowsRaw = interaction.options.getString("yellow_cards");
  const redsRaw = interaction.options.getString("red_cards");

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
      scorers: parsePlayerStatList(scorersRaw),
      assists: parsePlayerStatList(assistsRaw),
      motm: parseSinglePlayer(motmRaw),
      yellowCards: parsePlayerStatList(yellowsRaw),
      redCards: parsePlayerStatList(redsRaw),
      submittedByDiscordId: interaction.user.id,
    });

    const siteBase = env.VFL_SITE_URL.replace(/\/$/, "");
    const [homeLogoUrl, awayLogoUrl] = await Promise.all([
      match.home_slug
        ? fetchTeamLogoUrl(supabase, match.home_slug, siteBase)
        : Promise.resolve(null),
      match.away_slug
        ? fetchTeamLogoUrl(supabase, match.away_slug, siteBase)
        : Promise.resolve(null),
    ]);

    const embed = buildResultsEmbed({
      match,
      homeScore: scoreline.home,
      awayScore: scoreline.away,
      applied,
      submittedByTag: interaction.user.tag,
      homeLogoUrl,
      awayLogoUrl,
    });

    const channelId = env.DISCORD_RESULTS_CHANNEL_ID;
    const channel = (await interaction.client.channels.fetch(channelId).catch(
      () => null,
    )) as GuildTextBasedChannel | null;

    if (!channel?.isTextBased()) {
      await interaction.editReply({
        content:
          "Result saved to the database, but the results channel is missing or not text-based. Check **DISCORD_RESULTS_CHANNEL_ID**.",
      });
      return;
    }

    const posted = await channel.send({ embeds: [embed] });

    const warnBlock =
      applied.warnings.length > 0
        ? `\n\n**Notes**\n${applied.warnings.slice(0, 8).join("\n")}`
        : "";

    await interaction.editReply({
      content:
        `✅ Logged **${match.home_name} ${scoreline.home}–${scoreline.away} ${match.away_name}** (\`${match.roblox_match_id}\`). Posted ${posted.url}.${warnBlock}`,
    });
  } catch (err) {
    console.error("/results failed:", err);
    await interaction.editReply({
      content: `Could not log result: ${formatErr(err)}`,
    });
  }
}
