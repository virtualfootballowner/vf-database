import { EmbedBuilder } from "discord.js";

import { discordTeamLabel } from "@/bot/discord-team-flags";
import { env } from "@/bot/config";
import type { UnclaimedAssignmentAlertRow } from "@/bot/referees/unclaimed-alerts/queries";
import { formatDualTimezoneKickoffTime } from "@/lib/wc-fixture-kickoff";

function missingSlotsLabel(row: UnclaimedAssignmentAlertRow): string {
  if (row.missing_main && row.missing_linesman) {
    return "**Main ref** and **linesman** still open";
  }
  if (row.missing_main) return "**Main ref** still open";
  return "**Linesman** still open";
}

function kickoffUnix(iso: string): number | null {
  const ms = new Date(iso).getTime();
  if (Number.isNaN(ms)) return null;
  return Math.floor(ms / 1000);
}

export function buildUnclaimedAssignmentEmbed(
  row: UnclaimedAssignmentAlertRow,
): EmbedBuilder {
  const matchLine = `${discordTeamLabel(row.home_team_name, row.home_slug)} vs ${discordTeamLabel(row.away_team_name, row.away_slug)}`;
  const ts = kickoffUnix(row.scheduled_at);
  const kickoff = ts
    ? `${formatDualTimezoneKickoffTime(row.scheduled_at)}\n<t:${ts}:F> · <t:${ts}:R>`
    : formatDualTimezoneKickoffTime(row.scheduled_at);

  const siteBase = env.VFL_SITE_URL.replace(/\/$/, "");
  const fixtureUrl = row.roblox_match_id
    ? `${siteBase}/stats/matches/${encodeURIComponent(row.roblox_match_id)}`
    : null;

  const embed = new EmbedBuilder()
    .setColor(0xef4444)
    .setTitle("GAME NOT CLAIMED")
    .setDescription(
      [
        matchLine,
        "",
        missingSlotsLabel(row),
        "",
        "Kickoff in **24 hours** — claim on the fixture post above.",
      ].join("\n"),
    )
    .addFields(
      { name: "Competition", value: row.competition, inline: true },
      { name: "Season", value: String(row.season), inline: true },
      {
        name: "Game week",
        value: row.game_week_label ?? "—",
        inline: true,
      },
      { name: "Kickoff", value: kickoff, inline: false },
    )
    .setFooter({ text: `Assignment ${row.assignment_id.slice(0, 8)}…` })
    .setTimestamp(new Date());

  if (fixtureUrl) {
    embed.addFields({
      name: "Fixture",
      value: `[View on VF](${fixtureUrl})`,
      inline: false,
    });
  }

  return embed;
}

export function buildUnclaimedAssignmentPingContent(
  row: UnclaimedAssignmentAlertRow,
  refereeRoleId: string,
  guildId: string,
): string {
  const roleMention = `<@&${refereeRoleId}>`;
  if (row.channel_id && row.message_id) {
    return `${roleMention} 👆 **GAME NOT CLAIMED** — [jump to fixture](https://discord.com/channels/${guildId}/${row.channel_id}/${row.message_id})`;
  }
  return `${roleMention} 👆 **GAME NOT CLAIMED** — see embed below.`;
}
