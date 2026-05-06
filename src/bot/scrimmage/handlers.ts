import {
  EmbedBuilder,
  MessageFlags,
  type ChatInputCommandInteraction,
} from "discord.js";

import { env } from "@/bot/config";
import { createBotSupabase } from "@/bot/stats-queries";
import {
  countCompletedScrimmages,
  fetchScrimmageLeaderboard,
  fetchScrimmageStatsForDiscord,
  type LeaderboardEntry,
  type ScrimmageRatingRow,
} from "@/bot/scrimmage/db";
import { SCRIMMAGE_DEFAULT_ELO } from "@/bot/scrimmage/elo";
import {
  isScrimmageAdmin,
  isWhitelistedForScrimmage,
} from "@/bot/scrimmage/permissions";
import {
  handleScrimmageCancel,
  handleScrimmageStart,
} from "@/bot/scrimmage/queue";
import { handleScrimmageVoid } from "@/bot/scrimmage/result";

/* Re-export for callers that imported these from `handlers` historically. */
export {
  isScrimmageAdmin,
  isWhitelistedForScrimmage,
  handleScrimmageStart,
  handleScrimmageCancel,
  handleScrimmageVoid,
};

/**
 * Slash-command handlers for `/scrimmage <subcommand>`.
 *
 * V1 foundation: `/scrimmage stats` and `/scrimmage leaderboard` are fully
 * implemented (read-only). The interactive lobby/draft/match flow ships in
 * a follow-up push — those subcommands are stubbed with a friendly notice.
 */

const COLOR_BRAND = 0x083696;
const COLOR_NEUTRAL = 0x6b7280;

async function denyEphemeral(
  interaction: ChatInputCommandInteraction,
  content: string,
): Promise<void> {
  await interaction.reply({ flags: MessageFlags.Ephemeral, content });
}

function formatErr(err: unknown): string {
  if (err instanceof Error && err.message.trim()) return err.message.trim();
  return "unknown error";
}

/* ------------------------------------------------------------------ */
/*  /scrimmage stats [user]                                           */
/* ------------------------------------------------------------------ */

export async function handleScrimmageStats(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  const target = interaction.options.getUser("user") ?? interaction.user;
  await interaction.deferReply();

  try {
    const supabase = createBotSupabase();
    const result = await fetchScrimmageStatsForDiscord(supabase, target.id);
    if (!result) {
      await interaction.editReply({
        content:
          target.id === interaction.user.id
            ? "You don’t have a VF profile linked yet — verify on the website first."
            : `${target} doesn’t have a VF profile linked.`,
      });
      return;
    }

    const { roblox_username, rating, rank } = result;
    const embed = renderStatsEmbed({
      robloxUsername: roblox_username,
      rating,
      rank,
      siteBase: env.VFL_SITE_URL.replace(/\/$/, ""),
      target,
      isSelf: target.id === interaction.user.id,
    });

    await interaction.editReply({ embeds: [embed] });
  } catch (err) {
    console.error("/scrimmage stats failed:", err);
    await interaction.editReply({
      content: `Could not load scrimmage stats: ${formatErr(err)}`,
    });
  }
}

function renderStatsEmbed(args: {
  robloxUsername: string;
  rating: ScrimmageRatingRow;
  rank: number | null;
  siteBase: string;
  target: { id: string; username: string };
  isSelf: boolean;
}): EmbedBuilder {
  const { robloxUsername, rating, rank, siteBase, target, isSelf } = args;
  const profileUrl = `${siteBase}/players/${encodeURIComponent(robloxUsername)}`;

  const winRate =
    rating.games_played > 0
      ? Math.round((rating.wins / rating.games_played) * 100)
      : 0;
  const streakLabel =
    rating.current_streak > 0
      ? `🔥 **${rating.current_streak}-game** win streak`
      : rating.current_streak < 0
        ? `❄️ **${Math.abs(rating.current_streak)}-game** loss streak`
        : "—";
  const banLabel = (() => {
    if (!rating.ban_until) return null;
    const ts = new Date(rating.ban_until).getTime();
    if (Number.isNaN(ts) || ts <= Date.now()) return null;
    return `🚫 Banned from scrimmages until <t:${Math.floor(ts / 1000)}:f>`;
  })();

  const titleSubject = isSelf ? "Your scrimmage stats" : `${robloxUsername} · scrimmage stats`;
  const isUnranked = rating.games_played === 0;

  const embed = new EmbedBuilder()
    .setColor(isUnranked ? COLOR_NEUTRAL : COLOR_BRAND)
    .setAuthor({
      name: "VF FACEIT · Scrimmage profile",
      url: profileUrl,
    })
    .setTitle(titleSubject)
    .setURL(profileUrl)
    .setDescription(
      [
        `Discord · <@${target.id}>`,
        `Roblox · [${robloxUsername}](${profileUrl})`,
        isUnranked
          ? "*No scrimmages played yet — your rating starts at the seed value once you finish your first match.*"
          : null,
        banLabel,
      ]
        .filter(Boolean)
        .join("\n"),
    )
    .addFields(
      {
        name: "📈 ELO",
        value: `**${rating.elo}**${isUnranked ? " *(seed)*" : ""}`,
        inline: true,
      },
      {
        name: "🏔️ Peak",
        value: `**${rating.peak_elo}**`,
        inline: true,
      },
      {
        name: "🪪 Rank",
        value: rank != null ? `**#${rank}**` : "*unranked*",
        inline: true,
      },
      {
        name: "🎮 Games",
        value: `**${rating.games_played}**`,
        inline: true,
      },
      {
        name: "✅ W / 🤝 D / ❌ L",
        value: `**${rating.wins}** / **${rating.draws}** / **${rating.losses}**`,
        inline: true,
      },
      {
        name: "📊 Win rate",
        value: rating.games_played > 0 ? `**${winRate}%**` : "—",
        inline: true,
      },
      { name: "Streak", value: streakLabel, inline: true },
      {
        name: "AFK strikes",
        value: rating.afk_count > 0 ? `**${rating.afk_count}**` : "0",
        inline: true,
      },
    )
    .setFooter({
      text: `VF FACEIT · Seed ${SCRIMMAGE_DEFAULT_ELO} · K=25`,
    })
    .setTimestamp(new Date());

  return embed;
}

/* ------------------------------------------------------------------ */
/*  /scrimmage leaderboard                                            */
/* ------------------------------------------------------------------ */

export async function handleScrimmageLeaderboard(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  await interaction.deferReply();

  try {
    const supabase = createBotSupabase();
    const [rows, totalCompleted] = await Promise.all([
      fetchScrimmageLeaderboard(supabase, 10),
      countCompletedScrimmages(supabase),
    ]);

    if (rows.length === 0) {
      const empty = new EmbedBuilder()
        .setColor(COLOR_NEUTRAL)
        .setTitle("VF FACEIT · Scrimmage leaderboard")
        .setDescription(
          "*No scrimmages played yet.* Run **`/scrimmage start`** in the lobby channel once the lobby flow ships to seed the first match.",
        )
        .setFooter({ text: `VF FACEIT · Seed ${SCRIMMAGE_DEFAULT_ELO} · K=25` })
        .setTimestamp(new Date());
      await interaction.editReply({ embeds: [empty] });
      return;
    }

    const embed = renderLeaderboardEmbed(rows, totalCompleted);
    await interaction.editReply({ embeds: [embed] });
  } catch (err) {
    console.error("/scrimmage leaderboard failed:", err);
    await interaction.editReply({
      content: `Could not load leaderboard: ${formatErr(err)}`,
    });
  }
}

function renderLeaderboardEmbed(
  rows: LeaderboardEntry[],
  totalCompleted: number,
): EmbedBuilder {
  const medal = (idx: number) =>
    idx === 0
      ? "🥇"
      : idx === 1
        ? "🥈"
        : idx === 2
          ? "🥉"
          : `\`${String(idx + 1).padStart(2, " ")}\``;

  const lines = rows.map((row, idx) => {
    const record = `${row.wins}-${row.draws}-${row.losses}`;
    return `${medal(idx)}  **${row.roblox_username}** · 📈 **${row.elo}** · ${record} · 🏔️ ${row.peak_elo}`;
  });

  return new EmbedBuilder()
    .setColor(COLOR_BRAND)
    .setTitle("🏆 VF FACEIT · Scrimmage leaderboard")
    .setDescription(
      [
        `Top **${rows.length}** by current ELO (W-D-L · peak shown after).`,
        `**${totalCompleted}** ${totalCompleted === 1 ? "scrimmage" : "scrimmages"} on file.`,
        "",
        ...lines,
      ].join("\n"),
    )
    .setFooter({ text: `VF FACEIT · Seed ${SCRIMMAGE_DEFAULT_ELO} · K=25` })
    .setTimestamp(new Date());
}

/* ------------------------------------------------------------------ */
/*  /scrimmage report-afk — placeholder for the v1.1 voting flow      */
/* ------------------------------------------------------------------ */

/**
 * Mid-game AFK voting + escalating bans are deferred to v1.1. We still
 * register the slash command so the UI is stable, but it just tells the
 * caller the feature is coming.
 */
export async function handleScrimmageReportAfkStub(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  if (!isWhitelistedForScrimmage(interaction)) {
    await denyEphemeral(
      interaction,
      "You need the **Whitelisted** role to use this command.",
    );
    return;
  }
  await interaction.reply({
    flags: MessageFlags.Ephemeral,
    content:
      "🚧 Mid-game AFK voting + escalating bans land in v1.1. Captains can already report no-shows during the **ready check** — that's the v1.0 enforcement point.",
  });
}
