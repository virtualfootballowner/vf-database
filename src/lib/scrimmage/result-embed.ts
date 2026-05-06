/**
 * Discord embed renderers for completed/voided scrimmage matches.
 *
 * Returns plain APIEmbed JSON (no `discord.js` runtime dep) so the same
 * code can be used by:
 *   - The bot process (Railway) — passed straight to channel.send.
 *   - The website API route (Vercel) — POSTed to Discord REST when the
 *     auto-finalizer fires from a Roblox `match_end` event.
 *
 * Keep this file dependency-free. Anything pulled from `discord.js` will
 * break the Edge / Vercel build.
 */

export type APIEmbed = {
  title?: string;
  description?: string;
  color?: number;
  fields?: { name: string; value: string; inline?: boolean }[];
  footer?: { text: string };
  timestamp?: string;
};

export type ResultEmbedPlayer = {
  player_id: string;
  team: 1 | 2;
  pick_order: number | null;
  is_captain: boolean;
};

export type ResultEmbedScorer = {
  /** Display name to show on the line. Falls back to "Unknown" upstream. */
  name: string;
  /** How many goals this player scored (always >=1 when present). */
  goals: number;
};

export const RESULT_COLOR_LIVE = 0x16a34a;
export const RESULT_COLOR_NEUTRAL = 0x6b7280;

/**
 * The "result" card the bot/API replaces the lobby embed with after a
 * scrimmage finishes. Shows final score, ELO swing, full rosters with
 * delta indicators, and (when available) goal scorers from the
 * scrimmage_match_events stream.
 */
export function renderScrimmageResultEmbed(args: {
  matchCode: string;
  team1Score: number;
  team2Score: number;
  team1Avg: number;
  team2Avg: number;
  team1Delta: number;
  team2Delta: number;
  players: ResultEmbedPlayer[];
  /** roblox username keyed by `players.id`. */
  namesById: Map<string, string>;
  /** Optional list of scorers per team — rendered under the team header when present. */
  team1Scorers?: ResultEmbedScorer[];
  team2Scorers?: ResultEmbedScorer[];
  /** Free-text note shown below the score line ("Auto-finalized from Roblox.", etc.) */
  note: string;
}): APIEmbed {
  const winner =
    args.team1Score > args.team2Score
      ? "🅰 Team 1"
      : args.team2Score > args.team1Score
        ? "🅱 Team 2"
        : "Draw";

  const renderTeam = (team: 1 | 2, scorers?: ResultEmbedScorer[]): string => {
    const rows = args.players
      .filter((p) => p.team === team)
      .sort((a, b) => {
        if (a.is_captain && !b.is_captain) return -1;
        if (!a.is_captain && b.is_captain) return 1;
        return (a.pick_order ?? 0) - (b.pick_order ?? 0);
      })
      .map((p) => {
        const name = args.namesById.get(p.player_id) ?? "Unknown";
        const tag = p.is_captain ? "👑" : `\`#${p.pick_order ?? "—"}\``;
        return `${tag} **${name}**`;
      });
    const roster = rows.join("\n") || "—";
    if (!scorers || scorers.length === 0) return roster;
    const scorerLines = scorers
      .map((s) => `⚽ **${s.name}**${s.goals > 1 ? ` ×${s.goals}` : ""}`)
      .join("  ·  ");
    return `${roster}\n\n${scorerLines}`;
  };

  return {
    color: RESULT_COLOR_LIVE,
    title: `🏁 VF FACEIT · Result · ${args.matchCode}`,
    description: [
      `**${args.team1Score}** · **${args.team2Score}** — ${winner}`,
      "",
      `Team 1 avg ELO **${args.team1Avg}** · Δ **${signed(args.team1Delta)}**`,
      `Team 2 avg ELO **${args.team2Avg}** · Δ **${signed(args.team2Delta)}**`,
      "",
      `_${args.note}_`,
    ].join("\n"),
    fields: [
      {
        name: `🅰 Team 1 (${signed(args.team1Delta)})`,
        value: renderTeam(1, args.team1Scorers),
        inline: true,
      },
      {
        name: `🅱 Team 2 (${signed(args.team2Delta)})`,
        value: renderTeam(2, args.team2Scorers),
        inline: true,
      },
    ],
    footer: {
      text: "VF FACEIT · ELO updated · /scrimmage stats to view your rating.",
    },
    timestamp: new Date().toISOString(),
  };
}

export function renderScrimmageVoidedEmbed(args: {
  matchCode: string;
  voidedByMention: string;
}): APIEmbed {
  return {
    color: RESULT_COLOR_NEUTRAL,
    title: `🛑 Scrimmage voided · ${args.matchCode}`,
    description: [
      `Voided by ${args.voidedByMention}.`,
      "No ELO applied. Run **`/scrimmage start`** to open a fresh lobby.",
    ].join("\n"),
    footer: { text: "VF FACEIT" },
    timestamp: new Date().toISOString(),
  };
}

function signed(n: number): string {
  return n >= 0 ? `+${n}` : `${n}`;
}
