/**
 * League match result embed for Discord REST (no discord.js — safe on Vercel).
 */

import { discordTeamLabel } from "@/bot/discord-team-flags";
import { formatPlayerStatLines } from "@/bot/results/parse";
import type {
  ApplyMatchResultOutput,
  MatchForResults,
} from "@/bot/results/queries";
import type { DiscordEmbed } from "@/lib/discord-rest";

function matchPageUrl(siteBase: string, robloxMatchId: string): string {
  const base = siteBase.replace(/\/$/, "");
  return `${base}/stats/matches/${encodeURIComponent(robloxMatchId)}`;
}

function scorelineDescription(
  match: MatchForResults,
  homeScore: number,
  awayScore: number,
): string {
  const home = discordTeamLabel(match.home_name, match.home_slug);
  const away = discordTeamLabel(match.away_name, match.away_slug);
  const week = match.game_week_label?.trim() || match.stage?.trim() || "—";
  const fft =
    match.fft?.trim().toLowerCase() === "yes" ? " **FFT**" : "";
  return [
    `${home}  **${homeScore} – ${awayScore}**${fft}  ${away}`,
    "",
    `\`${match.roblox_match_id}\` · Season ${match.season} · ${week}`,
  ].join("\n");
}

export function renderLeagueResultsEmbed(input: {
  match: MatchForResults;
  homeScore: number;
  awayScore: number;
  applied: ApplyMatchResultOutput;
  submittedByTag: string;
  siteBaseUrl: string;
}): DiscordEmbed {
  const { match, homeScore, awayScore, applied } = input;
  const comp = match.competition?.trim() || "Competition";

  return {
    color: 0x083696,
    title: `⚽ Match result · ${comp}`,
    description: scorelineDescription(match, homeScore, awayScore),
    fields: [
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
        value: `[View on VF](${matchPageUrl(input.siteBaseUrl, match.roblox_match_id)})`,
        inline: true,
      },
    ],
    footer: {
      text: `Logged by ${input.submittedByTag} · VF World Cup results`,
    },
    timestamp: new Date().toISOString(),
  };
}
