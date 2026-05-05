/**
 * Phase 5 — Result reporting + ELO apply.
 *
 * Flow:
 *   - Either captain runs `/scrimmage report <self> <opp>` after the match.
 *   - The other captain has 2 minutes to Confirm or Dispute.
 *     - Confirm → applyScrimmageResult (ELO updates) + status=completed
 *     - Dispute → status=disputed (admin handles via /scrimmage admin-result)
 *     - No reply in 2 min → auto-accept (treated like a confirm)
 *   - Admin overrides:
 *     - `/scrimmage admin-result <code> <s1> <s2>` — overrides any state
 *     - `/scrimmage void <code>` — sets status=voided, no ELO change
 */

import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  MessageFlags,
  type ButtonInteraction,
  type ChatInputCommandInteraction,
  type TextChannel,
} from "discord.js";

import { createBotSupabase } from "@/bot/stats-queries";
import {
  applyScrimmageResult,
  fetchMatchPlayers,
  fetchPlayerNamesByIds,
  fetchScrimmageMatchByCode,
  updateScrimmageMatchStatus,
} from "@/bot/scrimmage/db";
import {
  clearActiveLobby,
  clearTimers,
  getActiveLobby,
} from "@/bot/scrimmage/state";
import {
  isScrimmageAdmin,
  isWhitelistedForScrimmage,
} from "@/bot/scrimmage/permissions";

const COLOR_LIVE = 0x16a34a;
const COLOR_DISPUTE = 0xdc2626;

export const CONFIRM_WINDOW_MS = 2 * 60 * 1000;
export const SCR_BTN_CONFIRM_PREFIX = "vfl:scr:confirm:";
export const SCR_BTN_DISPUTE_PREFIX = "vfl:scr:dispute:";

/* In-memory map of pending confirmations.
 *
 * Keyed by matchId. Each entry holds the auto-accept timer + the channel +
 * message id of the confirm card. Lost on bot restart, which is acceptable
 * — the match row in DB stays at status=pending_confirmation and an admin
 * can resolve via /scrimmage admin-result.
 */
type PendingConfirm = {
  matchId: string;
  reportedByPlayerId: string;
  reportedByDiscordId: string;
  opposingCaptainPlayerId: string;
  opposingCaptainDiscordId: string;
  team1Score: number;
  team2Score: number;
  /** Direct reference so we can edit the card without re-fetching from the
   *  client object (and without an awkward dynamic import to bot/index). */
  channel: TextChannel;
  messageId: string;
  timer: ReturnType<typeof setTimeout>;
};

const pendingConfirms = new Map<string, PendingConfirm>();

/* ------------------------------------------------------------------ */
/*  /scrimmage report <my-score> <opp-score>                          */
/* ------------------------------------------------------------------ */

export async function handleScrimmageReport(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  if (!isWhitelistedForScrimmage(interaction)) {
    await interaction.reply({
      flags: MessageFlags.Ephemeral,
      content: "You need the **Whitelisted** role to report results.",
    });
    return;
  }

  const myScore = interaction.options.getInteger("my-score", true);
  const oppScore = interaction.options.getInteger("opp-score", true);

  if (
    !Number.isInteger(myScore) ||
    !Number.isInteger(oppScore) ||
    myScore < 0 ||
    oppScore < 0 ||
    myScore > 99 ||
    oppScore > 99
  ) {
    await interaction.reply({
      flags: MessageFlags.Ephemeral,
      content: "Scores must be integers between 0 and 99.",
    });
    return;
  }

  const lobby = getActiveLobby();
  if (!lobby || lobby.phase !== "live") {
    await interaction.reply({
      flags: MessageFlags.Ephemeral,
      content:
        "There’s no live match right now. If your match is on file but not in memory, ask an admin for **`/scrimmage admin-result`**.",
    });
    return;
  }

  const reportingCaptain =
    lobby.captain1?.discordId === interaction.user.id
      ? lobby.captain1
      : lobby.captain2?.discordId === interaction.user.id
        ? lobby.captain2
        : null;
  if (!reportingCaptain) {
    await interaction.reply({
      flags: MessageFlags.Ephemeral,
      content: "Only the team captains can report results.",
    });
    return;
  }

  // Already pending?
  if (pendingConfirms.has(lobby.matchId)) {
    await interaction.reply({
      flags: MessageFlags.Ephemeral,
      content:
        "A result is already awaiting confirmation. Ask the opposing captain to use the buttons in the lobby channel.",
    });
    return;
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  // Translate "my / opp" into "team1 / team2" canonical scores.
  const [team1Score, team2Score] =
    reportingCaptain.team === 1
      ? [myScore, oppScore]
      : [oppScore, myScore];

  const opposingCaptain =
    reportingCaptain.team === 1 ? lobby.captain2! : lobby.captain1!;

  const supabase = createBotSupabase();
  try {
    await updateScrimmageMatchStatus(
      supabase,
      lobby.matchId,
      "pending_confirmation",
      {
        team1_score: team1Score,
        team2_score: team2Score,
        reported_by: reportingCaptain.playerId,
        result_reported_at: new Date().toISOString(),
      },
    );
  } catch (err) {
    console.error("[scrimmage] report status update failed:", err);
    await interaction.editReply({
      content: "Couldn’t save the report. Try again or ask an admin.",
    });
    return;
  }

  // Stop timers attached to the lobby — match is no longer "live".
  clearTimers(lobby);

  // Post a confirm/dispute card mentioning the opposing captain.
  const cardEmbed = renderPendingConfirmEmbed({
    matchCode: lobby.matchCode,
    reportingTeam: reportingCaptain.team,
    reportingCaptainName: reportingCaptain.robloxUsername,
    opposingCaptainName: opposingCaptain.robloxUsername,
    opposingCaptainDiscordId: opposingCaptain.discordId,
    team1Score,
    team2Score,
    deadlineMs: Date.now() + CONFIRM_WINDOW_MS,
  });
  const buttons = renderConfirmButtons(lobby.matchId);

  let posted;
  try {
    posted = await lobby.channel.send({
      content: `<@${opposingCaptain.discordId}> — confirm or dispute the result.`,
      embeds: [cardEmbed],
      components: [buttons],
    });
  } catch (err) {
    console.error("[scrimmage] confirm card send failed:", err);
    await interaction.editReply({
      content:
        "Saved the report but couldn’t post the confirm card. Ask an admin to apply it manually.",
    });
    return;
  }

  // Auto-accept timer
  const timer = setTimeout(() => {
    void onConfirmAutoAccept(lobby.matchId).catch((err) =>
      console.error("[scrimmage] onConfirmAutoAccept failed:", err),
    );
  }, CONFIRM_WINDOW_MS);

  pendingConfirms.set(lobby.matchId, {
    matchId: lobby.matchId,
    reportedByPlayerId: reportingCaptain.playerId,
    reportedByDiscordId: reportingCaptain.discordId,
    opposingCaptainPlayerId: opposingCaptain.playerId,
    opposingCaptainDiscordId: opposingCaptain.discordId,
    team1Score,
    team2Score,
    channel: lobby.channel,
    messageId: posted.id,
    timer,
  });

  await interaction.editReply({
    content: `✅ Result submitted (${team1Score}-${team2Score}). The opposing captain has 2 minutes to confirm — ${posted.url}`,
  });
}

/* ------------------------------------------------------------------ */
/*  Confirm / dispute buttons                                         */
/* ------------------------------------------------------------------ */

export async function handleConfirmButton(
  interaction: ButtonInteraction,
  matchId: string,
): Promise<void> {
  const pending = pendingConfirms.get(matchId);
  if (!pending) {
    await interaction.reply({
      flags: MessageFlags.Ephemeral,
      content: "This result is no longer pending. It may have already been resolved.",
    });
    return;
  }

  if (interaction.user.id !== pending.opposingCaptainDiscordId) {
    await interaction.reply({
      flags: MessageFlags.Ephemeral,
      content: "Only the opposing captain can confirm or dispute this result.",
    });
    return;
  }

  await interaction.deferUpdate();
  await finalizeConfirmation(pending, {
    confirmedByPlayerId: pending.opposingCaptainPlayerId,
    note: "Confirmed by opposing captain.",
  });
}

export async function handleDisputeButton(
  interaction: ButtonInteraction,
  matchId: string,
): Promise<void> {
  const pending = pendingConfirms.get(matchId);
  if (!pending) {
    await interaction.reply({
      flags: MessageFlags.Ephemeral,
      content: "This result is no longer pending.",
    });
    return;
  }

  if (interaction.user.id !== pending.opposingCaptainDiscordId) {
    await interaction.reply({
      flags: MessageFlags.Ephemeral,
      content: "Only the opposing captain can dispute this result.",
    });
    return;
  }

  await interaction.deferUpdate();

  clearTimeout(pending.timer);
  pendingConfirms.delete(matchId);

  try {
    await updateScrimmageMatchStatus(
      createBotSupabase(),
      pending.matchId,
      "disputed",
    );
  } catch (err) {
    console.error("[scrimmage] dispute status update failed:", err);
  }

  // Edit the confirm card to a dispute summary.
  try {
    const msg = await pending.channel.messages
      .fetch(pending.messageId)
      .catch(() => null);
    if (msg) {
      await msg.edit({
        content: "",
        embeds: [
          new EmbedBuilder()
            .setColor(COLOR_DISPUTE)
            .setTitle(`⚖️ Result disputed`)
            .setDescription(
              [
                `Match \`${pending.matchId.slice(0, 8)}…\` is now **disputed**.`,
                `An admin must resolve with **/scrimmage admin-result**.`,
              ].join("\n"),
            )
            .setFooter({ text: "VF FACEIT · No ELO applied yet." })
            .setTimestamp(new Date()),
        ],
        components: [],
      });
    }
  } catch (err) {
    console.error("[scrimmage] dispute card edit failed:", err);
  }

  // Clear the live lobby — the match is no longer in flight from the bot's
  // POV. Admin will use /scrimmage admin-result to apply the final score.
  clearActiveLobby();
}

/* ------------------------------------------------------------------ */
/*  Auto-accept after 2 min                                           */
/* ------------------------------------------------------------------ */

async function onConfirmAutoAccept(matchId: string): Promise<void> {
  const pending = pendingConfirms.get(matchId);
  if (!pending) return;
  await finalizeConfirmation(pending, {
    confirmedByPlayerId: null,
    note: "Auto-accepted after 2 minutes.",
  });
}

/* ------------------------------------------------------------------ */
/*  Apply ELO + edit cards                                            */
/* ------------------------------------------------------------------ */

async function finalizeConfirmation(
  pending: PendingConfirm,
  args: { confirmedByPlayerId: string | null; note: string },
): Promise<void> {
  clearTimeout(pending.timer);
  pendingConfirms.delete(pending.matchId);

  const supabase = createBotSupabase();
  let result;
  try {
    result = await applyScrimmageResult(supabase, {
      matchId: pending.matchId,
      team1Score: pending.team1Score,
      team2Score: pending.team2Score,
      reportedBy: pending.reportedByPlayerId,
      confirmedBy: args.confirmedByPlayerId,
    });
  } catch (err) {
    console.error("[scrimmage] applyScrimmageResult failed:", err);
    return;
  }

  // Resolve player names for the result embed
  const players = await fetchMatchPlayers(supabase, pending.matchId);
  const namesById = await fetchPlayerNamesByIds(
    supabase,
    players.map((p) => p.player_id),
  );

  try {
    const msg = await pending.channel.messages
      .fetch(pending.messageId)
      .catch(() => null);
    if (msg) {
      await msg.edit({
        content: "",
        embeds: [
          renderResultEmbed({
            note: args.note,
            team1Score: pending.team1Score,
            team2Score: pending.team2Score,
            players,
            namesById,
            team1Avg: result.team1Avg,
            team2Avg: result.team2Avg,
            team1Delta: result.team1Delta,
            team2Delta: result.team2Delta,
          }),
        ],
        components: [],
      });
    }
  } catch (err) {
    console.error("[scrimmage] result card edit failed:", err);
  }

  // Clear live lobby (match completed)
  clearActiveLobby();
}

/* ------------------------------------------------------------------ */
/*  /scrimmage admin-result <code> <s1> <s2>                          */
/* ------------------------------------------------------------------ */

export async function handleScrimmageAdminResult(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  if (!isScrimmageAdmin(interaction)) {
    await interaction.reply({
      flags: MessageFlags.Ephemeral,
      content:
        "You need **Administrator** (or be the server owner) to override scrimmage results.",
    });
    return;
  }

  const matchCode = interaction.options.getString("code", true).trim();
  const team1Score = interaction.options.getInteger("team1-score", true);
  const team2Score = interaction.options.getInteger("team2-score", true);

  if (
    !Number.isInteger(team1Score) ||
    !Number.isInteger(team2Score) ||
    team1Score < 0 ||
    team2Score < 0 ||
    team1Score > 99 ||
    team2Score > 99
  ) {
    await interaction.reply({
      flags: MessageFlags.Ephemeral,
      content: "Scores must be integers between 0 and 99.",
    });
    return;
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const supabase = createBotSupabase();
  const match = await fetchScrimmageMatchByCode(supabase, matchCode).catch(
    (err) => {
      console.error("[scrimmage] fetchScrimmageMatchByCode failed:", err);
      return null;
    },
  );
  if (!match) {
    await interaction.editReply({
      content: `No scrimmage with code \`${matchCode}\`.`,
    });
    return;
  }
  if (match.status === "completed" || match.status === "voided") {
    await interaction.editReply({
      content: `Match \`${matchCode}\` is already \`${match.status}\` — refusing to overwrite.`,
    });
    return;
  }
  if (!match.team1_captain_id || !match.team2_captain_id) {
    await interaction.editReply({
      content: `Match \`${matchCode}\` has no captains on file — can’t apply ELO.`,
    });
    return;
  }

  // Drop any in-memory pending confirm for this match.
  const pending = pendingConfirms.get(match.id);
  if (pending) {
    clearTimeout(pending.timer);
    pendingConfirms.delete(match.id);
  }

  let result;
  try {
    result = await applyScrimmageResult(supabase, {
      matchId: match.id,
      team1Score,
      team2Score,
      reportedBy: match.reported_by ?? null,
      confirmedBy: null,
    });
  } catch (err) {
    console.error("[scrimmage] admin-result apply failed:", err);
    await interaction.editReply({
      content: `Couldn’t apply result: ${err instanceof Error ? err.message : "unknown error"}`,
    });
    return;
  }

  // Wipe in-memory lobby if it matched
  const lobby = getActiveLobby();
  if (lobby && lobby.matchId === match.id) {
    clearActiveLobby();
  }

  await interaction.editReply({
    content: `✅ Applied **${team1Score}-${team2Score}** to \`${matchCode}\`. T1 Δ ${signed(result.team1Delta)} · T2 Δ ${signed(result.team2Delta)}.`,
  });
}

/* ------------------------------------------------------------------ */
/*  /scrimmage void <code>                                            */
/* ------------------------------------------------------------------ */

export async function handleScrimmageVoid(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  if (!isScrimmageAdmin(interaction)) {
    await interaction.reply({
      flags: MessageFlags.Ephemeral,
      content:
        "You need **Administrator** (or be the server owner) to void a scrimmage.",
    });
    return;
  }

  const matchCode = interaction.options.getString("code", true).trim();
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const supabase = createBotSupabase();
  const match = await fetchScrimmageMatchByCode(supabase, matchCode).catch(
    (err) => {
      console.error("[scrimmage] fetchScrimmageMatchByCode failed:", err);
      return null;
    },
  );
  if (!match) {
    await interaction.editReply({
      content: `No scrimmage with code \`${matchCode}\`.`,
    });
    return;
  }
  if (match.status === "completed") {
    await interaction.editReply({
      content: `Match \`${matchCode}\` is already completed and ELO has been applied. Use **\`/scrimmage admin-result\`** if you want to overwrite the score (won't roll back ELO).`,
    });
    return;
  }
  if (match.status === "voided" || match.status === "cancelled") {
    await interaction.editReply({
      content: `Match \`${matchCode}\` is already \`${match.status}\`.`,
    });
    return;
  }

  try {
    await updateScrimmageMatchStatus(supabase, match.id, "voided");
  } catch (err) {
    console.error("[scrimmage] void status update failed:", err);
    await interaction.editReply({
      content: `Couldn’t void: ${err instanceof Error ? err.message : "unknown error"}`,
    });
    return;
  }

  // Drop any in-memory pending confirm
  const pending = pendingConfirms.get(match.id);
  if (pending) {
    clearTimeout(pending.timer);
    pendingConfirms.delete(match.id);
  }

  const lobby = getActiveLobby();
  if (lobby && lobby.matchId === match.id) {
    clearActiveLobby();
  }

  await interaction.editReply({
    content: `✅ Voided \`${matchCode}\` (was \`${match.status}\`). No ELO applied.`,
  });
}

/* ------------------------------------------------------------------ */
/*  Utilities                                                         */
/* ------------------------------------------------------------------ */

function signed(n: number): string {
  return n >= 0 ? `+${n}` : `${n}`;
}

/** Used by handlers.ts to surface the report-AFK stub. */
export function isWaitingForConfirmation(matchId: string): boolean {
  return pendingConfirms.has(matchId);
}

/* ------------------------------------------------------------------ */
/*  Renderers                                                         */
/* ------------------------------------------------------------------ */

function renderConfirmButtons(
  matchId: string,
): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`${SCR_BTN_CONFIRM_PREFIX}${matchId}`)
      .setLabel("Confirm")
      .setStyle(ButtonStyle.Success)
      .setEmoji("✅"),
    new ButtonBuilder()
      .setCustomId(`${SCR_BTN_DISPUTE_PREFIX}${matchId}`)
      .setLabel("Dispute")
      .setStyle(ButtonStyle.Danger)
      .setEmoji("⚖️"),
  );
}

function renderPendingConfirmEmbed(args: {
  matchCode: string;
  reportingTeam: 1 | 2;
  reportingCaptainName: string;
  opposingCaptainName: string;
  opposingCaptainDiscordId: string;
  team1Score: number;
  team2Score: number;
  deadlineMs: number;
}): EmbedBuilder {
  const deadlineUnix = Math.floor(args.deadlineMs / 1000);
  return new EmbedBuilder()
    .setColor(COLOR_LIVE)
    .setTitle(`📊 Result submitted · ${args.matchCode}`)
    .setDescription(
      [
        `**${args.reportingCaptainName}** (T${args.reportingTeam}) reported the result.`,
        "",
        `**Team 1** · **${args.team1Score}**`,
        `**Team 2** · **${args.team2Score}**`,
        "",
        `<@${args.opposingCaptainDiscordId}> — confirm or dispute below.`,
        `Auto-accepts <t:${deadlineUnix}:R>.`,
      ].join("\n"),
    )
    .setFooter({
      text: "VF FACEIT · ELO applies on confirm or auto-accept.",
    })
    .setTimestamp(new Date());
}

function renderResultEmbed(args: {
  note: string;
  team1Score: number;
  team2Score: number;
  players: { player_id: string; team: 1 | 2; pick_order: number | null; is_captain: boolean }[];
  namesById: Map<string, string>;
  team1Avg: number;
  team2Avg: number;
  team1Delta: number;
  team2Delta: number;
}): EmbedBuilder {
  const winner =
    args.team1Score > args.team2Score
      ? "🅰 Team 1"
      : args.team2Score > args.team1Score
        ? "🅱 Team 2"
        : "Draw";

  const renderTeam = (team: 1 | 2): string => {
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
    return rows.join("\n") || "—";
  };

  return new EmbedBuilder()
    .setColor(COLOR_LIVE)
    .setTitle(`🏁 Result confirmed`)
    .setDescription(
      [
        `**${args.team1Score}** · **${args.team2Score}** — ${winner}`,
        "",
        `Team 1 avg ELO **${args.team1Avg}** · Δ **${signed(args.team1Delta)}**`,
        `Team 2 avg ELO **${args.team2Avg}** · Δ **${signed(args.team2Delta)}**`,
        "",
        `_${args.note}_`,
      ].join("\n"),
    )
    .addFields(
      {
        name: `🅰 Team 1 (${signed(args.team1Delta)})`,
        value: renderTeam(1),
        inline: true,
      },
      {
        name: `🅱 Team 2 (${signed(args.team2Delta)})`,
        value: renderTeam(2),
        inline: true,
      },
    )
    .setFooter({
      text: "VF FACEIT · Run /scrimmage stats to see your updated rating.",
    })
    .setTimestamp(new Date());
}
