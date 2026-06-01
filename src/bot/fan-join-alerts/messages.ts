import { EmbedBuilder } from "discord.js";

import { env } from "@/bot/config";
import { discordTeamLabel } from "@/bot/discord-team-flags";
import { fixturePageUrl } from "@/bot/fixture-reminders/messages";
import type { ScheduledMatchReminderRow } from "@/bot/fixture-reminders/queries";
import { discordKickoffTimestampRich } from "@/bot/postpone/format";

function robloxGameUrl(): string | null {
  const placeId = env.VF_ROBLOX_LOBBY_PLACE_ID?.trim();
  if (!placeId) return null;
  return `https://www.roblox.com/games/start?placeId=${encodeURIComponent(placeId)}`;
}

export function buildFanJoinAlertMessage(match: ScheduledMatchReminderRow): {
  content: string;
  embed: EmbedBuilder;
} {
  const competition = match.competition?.trim() || "VF League";
  const week =
    match.game_week_label?.trim() && match.game_week_label !== "—"
      ? match.game_week_label
      : null;
  const fixtureUrl = fixturePageUrl(match);
  const kickoffRich = discordKickoffTimestampRich(match.scheduled_at);
  const home = discordTeamLabel(match.home_name, match.home_slug);
  const away = discordTeamLabel(match.away_name, match.away_slug);
  const gameUrl = robloxGameUrl();

  const lines = [
    `@here ⚽ **Kickoff in 10 minutes** — hop in and support your team!`,
    "",
    `${home} vs ${away}`,
    `📅 ${kickoffRich}`,
    week ? `🏆 ${competition} · ${week}` : `🏆 ${competition}`,
  ];

  if (gameUrl) {
    lines.push("", `🎮 [Join on Roblox](${gameUrl})`);
  }

  lines.push(`📋 [View fixture](${fixtureUrl})`);

  const embed = new EmbedBuilder()
    .setColor(0x10b981)
    .setTitle("Match starting soon")
    .setDescription(`${home} vs ${away}`)
    .addFields(
      {
        name: "Kickoff",
        value: kickoffRich,
        inline: true,
      },
      {
        name: "Competition",
        value: week ? `${competition}\n${week}` : competition,
        inline: true,
      },
      {
        name: "Links",
        value: gameUrl
          ? `[Join on Roblox](${gameUrl}) · [Fixture](${fixtureUrl})`
          : `[View fixture](${fixtureUrl})`,
        inline: false,
      },
    )
    .setFooter({ text: "VF League · 10-minute fan alert" })
    .setTimestamp(new Date(match.scheduled_at));

  return {
    content: lines.join("\n"),
    embed,
  };
}
