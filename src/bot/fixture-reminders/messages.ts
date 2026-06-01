import { EmbedBuilder } from "discord.js";

import { env } from "@/bot/config";
import type { ReminderKind, ScheduledMatchReminderRow } from "@/bot/fixture-reminders/queries";
import { formatDualTimezoneKickoffTime } from "@/lib/wc-fixture-kickoff";

export type ManagerFixtureSide = {
  mySlug: string;
  myName: string;
  opponentSlug: string;
  opponentName: string;
};

function siteBase(): string {
  return env.VFL_SITE_URL.replace(/\/$/, "");
}

export function fixturePageUrl(match: ScheduledMatchReminderRow): string {
  const base = siteBase();
  const code = match.roblox_match_id?.trim();
  if (code) {
    return `${base}/stats/matches/${encodeURIComponent(code)}`;
  }
  return `${base}/stats/matches`;
}

export function opponentSquadUrl(opponentSlug: string, season: number): string {
  return `${siteBase()}/teams/${encodeURIComponent(opponentSlug)}?season=${season}`;
}

function kickoffDateLabel(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "TBD";
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Europe/London",
  }).format(d);
}

export function buildFixtureReminderEmbed(input: {
  match: ScheduledMatchReminderRow;
  side: ManagerFixtureSide;
  kind: ReminderKind;
  season: number;
  myLogoUrl: string | null;
}): EmbedBuilder {
  const { match, side, kind, season, myLogoUrl } = input;
  const kickoffTime = formatDualTimezoneKickoffTime(match.scheduled_at);
  const kickoffDate = kickoffDateLabel(match.scheduled_at);
  const fixtureUrl = fixturePageUrl(match);
  const squadUrl = opponentSquadUrl(side.opponentSlug, season);

  const competition = match.competition?.trim() || "VF League";
  const week =
    match.game_week_label?.trim() && match.game_week_label !== "—"
      ? match.game_week_label
      : null;

  const isOneHour = kind === "1h";
  const accent = isOneHour ? 0xf59e0b : 0x083696;
  const headline = isOneHour ? "Match in 1 hour" : "Match in 24 hours";
  const lead = isOneHour
    ? "Kickoff is **one hour away**. Get your squad ready and review your opponent."
    : "Your fixture is **tomorrow**. Review your squad and scout the opposition on the site.";

  const embed = new EmbedBuilder()
    .setColor(accent)
    .setAuthor({
      name: `${side.myName} · manager reminder`,
      iconURL: myLogoUrl ?? undefined,
    })
    .setTitle(`⏰ ${headline}`)
    .setDescription(
      [
        lead,
        "",
        `**${side.myName}** vs **${side.opponentName}**`,
      ].join("\n"),
    )
    .addFields(
      {
        name: "📅 Kickoff",
        value: `${kickoffDate}\n${kickoffTime}`,
        inline: false,
      },
      {
        name: "🏆 Competition",
        value: week ? `${competition} · ${week}` : competition,
        inline: true,
      },
      {
        name: "🆚 Opponent",
        value: side.opponentName,
        inline: true,
      },
      {
        name: "🔗 Links",
        value: [
          `[View fixture on VF](${fixtureUrl})`,
          `[${side.opponentName} squad sheet](${squadUrl})`,
        ].join("\n"),
        inline: false,
      },
    )
    .setFooter({
      text: isOneHour
        ? "VF League · 1-hour reminder"
        : "VF League · 24-hour reminder",
    })
    .setTimestamp(new Date(match.scheduled_at));

  if (myLogoUrl) embed.setThumbnail(myLogoUrl);

  return embed;
}
