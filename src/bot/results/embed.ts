import { EmbedBuilder } from "discord.js";

import { env } from "@/bot/config";
import { formatPlayerStatLines } from "@/bot/results/parse";
import type {
  ApplyMatchResultOutput,
  MatchForResults,
} from "@/bot/results/queries";
import { discordTeamLabel } from "@/bot/discord-team-flags";
import { absoluteSiteAssetUrl } from "@/bot/site-assets";

function matchPageUrl(robloxMatchId: string): string {
  const base = env.VFL_SITE_URL.replace(/\/$/, "");
  return `${base}/stats/matches/${encodeURIComponent(robloxMatchId)}`;
}

export function buildResultsEmbed(input: {
  match: MatchForResults;
  homeScore: number;
  awayScore: number;
  applied: ApplyMatchResultOutput;
  submittedByTag: string;
  homeLogoUrl?: string | null;
  awayLogoUrl?: string | null;
}): EmbedBuilder {
  const { match, homeScore, awayScore, applied } = input;
  const comp = match.competition?.trim() || "Competition";
  const week = match.game_week_label?.trim() || match.stage?.trim() || "—";

  const embed = new EmbedBuilder()
    .setColor(0x083696)
    .setTitle(`⚽ Match result · ${comp}`)
    .setDescription(
      [
        `${discordTeamLabel(match.home_name, match.home_slug)}  **${homeScore} – ${awayScore}**  ${discordTeamLabel(match.away_name, match.away_slug)}`,
        "",
        `\`${match.roblox_match_id}\` · Season ${match.season} · ${week}`,
      ].join("\n"),
    )
    .addFields(
      {
        name: "⚽ Scorers",
        value: formatPlayerStatLines(
          applied.resolvedScorers.map((r) => ({
            username: r.username,
            count: r.count,
          })),
        ),
        inline: true,
      },
      {
        name: "🅰️ Assists",
        value: formatPlayerStatLines(
          applied.resolvedAssists.map((r) => ({
            username: r.username,
            count: r.count,
          })),
        ),
        inline: true,
      },
      {
        name: "⭐ Man of the match",
        value: applied.resolvedMotm
          ? `**${applied.resolvedMotm.username}**`
          : "_Not recorded_",
        inline: true,
      },
      {
        name: "🟨 Yellow cards",
        value: formatPlayerStatLines(
          applied.resolvedYellows.map((r) => ({
            username: r.username,
            count: r.count,
          })),
        ),
        inline: true,
      },
      {
        name: "🟥 Red cards",
        value: formatPlayerStatLines(
          applied.resolvedReds.map((r) => ({
            username: r.username,
            count: r.count,
          })),
        ),
        inline: true,
      },
      {
        name: "Match sheet",
        value: `[View on VF](${matchPageUrl(match.roblox_match_id)})`,
        inline: true,
      },
    )
    .setFooter({
      text: `Logged by ${input.submittedByTag} · VF League results`,
    })
    .setTimestamp(new Date());

  const homeLogo = input.homeLogoUrl?.trim() || null;
  const awayLogo = input.awayLogoUrl?.trim() || null;
  if (homeLogo && awayLogo) {
    embed.setThumbnail(homeLogo).setImage(awayLogo);
  } else if (homeLogo) {
    embed.setThumbnail(homeLogo);
  } else if (awayLogo) {
    embed.setThumbnail(awayLogo);
  } else {
    const fallback = absoluteSiteAssetUrl("/golden shield.png", env.VFL_SITE_URL);
    if (fallback) embed.setThumbnail(fallback);
  }

  return embed;
}
