/**
 * Phase 4 — Ready Check.
 *
 * After the draft completes we hold a 60s ready check. Every player must
 * click READY. On expiry:
 *
 *   - Anyone who didn't ready is marked AFK (`scrimmage_players.is_afk=true`)
 *     and gets the -15 ELO no-show penalty.
 *   - If either captain failed to ready → cancel the match.
 *   - If, after AFK removal, either team has < 8 players → cancel.
 *   - Otherwise, if the teams are now uneven, bench the last-drafted player
 *     from the larger team (no penalty) so both sides match.
 *   - Go live: status='live', match_started_at = now. Edit lobby card to
 *     a "live" view with the match code + report instructions.
 */

import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  type ButtonInteraction,
} from "discord.js";

import { createBotSupabase } from "@/bot/stats-queries";
import {
  applyNoShowPenalty,
  markPlayerReady,
  removeBenchedPlayer,
  updateScrimmageMatchStatus,
} from "@/bot/scrimmage/db";
import { cancelLobby } from "@/bot/scrimmage/lifecycle";
import {
  clearTimers,
  getActiveLobby,
  type ActiveLobby,
  type DraftedPlayer,
} from "@/bot/scrimmage/state";

const COLOR_BRAND = 0x083696;
const COLOR_LIVE = 0x16a34a;
const COLOR_WARN = 0xf59e0b;

export const READY_CHECK_DURATION_MS = 5 * 60 * 1000;
export const NO_SHOW_PENALTY = -15;
export const MIN_TEAM_SIZE = 8;
export const SCR_BTN_READY = "vfl:scr:ready";

/* ------------------------------------------------------------------ */
/*  Entry point — called by draft.ts on last pick                     */
/* ------------------------------------------------------------------ */

export async function startReadyCheck(lobby: ActiveLobby): Promise<void> {
  clearTimers(lobby);
  lobby.phase = "ready_check";
  lobby.readyDeadline = Date.now() + READY_CHECK_DURATION_MS;

  // Reset ready flags (in case of a re-entry)
  for (const t of [lobby.team1, lobby.team2]) {
    for (const p of t) p.ready = false;
  }

  try {
    await updateScrimmageMatchStatus(
      createBotSupabase(),
      lobby.matchId,
      "ready_check",
    );
  } catch (err) {
    console.error("[scrimmage] startReadyCheck status update failed:", err);
  }

  await editReadyCard(lobby);

  lobby.timers.readyExpire = setTimeout(() => {
    void onReadyExpire(lobby.matchId).catch((err) =>
      console.error("[scrimmage] onReadyExpire failed:", err),
    );
  }, READY_CHECK_DURATION_MS);
}

/* ------------------------------------------------------------------ */
/*  READY button                                                      */
/* ------------------------------------------------------------------ */

export async function handleReadyButton(
  interaction: ButtonInteraction,
): Promise<void> {
  const lobby = getActiveLobby();
  if (!lobby || lobby.phase !== "ready_check") {
    await interaction.reply({
      flags: 1 << 6,
      content: "There’s no active ready check.",
    });
    return;
  }

  const all = [...lobby.team1, ...lobby.team2];
  const player = all.find((p) => p.discordId === interaction.user.id);
  if (!player) {
    await interaction.reply({
      flags: 1 << 6,
      content: "You’re not on a roster for this match.",
    });
    return;
  }
  if (player.ready) {
    await interaction.reply({
      flags: 1 << 6,
      content: "You’re already ready ✅",
    });
    return;
  }

  player.ready = true;

  try {
    await markPlayerReady(createBotSupabase(), lobby.matchId, player.playerId);
  } catch (err) {
    console.error("[scrimmage] markPlayerReady failed:", err);
  }

  await interaction.deferUpdate();
  await editReadyCard(lobby);

  const allReady = all.every((p) => p.ready);
  if (allReady) {
    if (lobby.timers.readyExpire) {
      clearTimeout(lobby.timers.readyExpire);
      lobby.timers.readyExpire = undefined;
    }
    await goLive(lobby).catch((err) =>
      console.error("[scrimmage] goLive failed:", err),
    );
  }
}

/* ------------------------------------------------------------------ */
/*  Timer expiry                                                      */
/* ------------------------------------------------------------------ */

async function onReadyExpire(matchId: string): Promise<void> {
  const lobby = getActiveLobby();
  if (!lobby || lobby.matchId !== matchId || lobby.phase !== "ready_check") {
    return;
  }

  const supabase = createBotSupabase();

  // Determine AFKs (those who didn't ready)
  const allPlayers = [...lobby.team1, ...lobby.team2];
  const afks = allPlayers.filter((p) => !p.ready);

  // Apply -15 ELO penalty to every AFK in scrimmage_ratings
  for (const afk of afks) {
    try {
      await applyNoShowPenalty(supabase, {
        matchId: lobby.matchId,
        playerId: afk.playerId,
        penalty: NO_SHOW_PENALTY,
      });
    } catch (err) {
      console.error("[scrimmage] applyNoShowPenalty failed:", err);
    }
  }

  // Captain AFK → match can't proceed.
  const c1Ready = lobby.captain1?.ready === true;
  const c2Ready = lobby.captain2?.ready === true;
  if (!c1Ready || !c2Ready) {
    await cancelLobby(
      lobby,
      `captain didn’t ready up — ${afks.length} no-show${afks.length === 1 ? "" : "s"} penalised (${NO_SHOW_PENALTY} ELO each)`,
    );
    return;
  }

  // Remove non-captain AFKs from rosters
  lobby.team1 = lobby.team1.filter((p) => p.ready);
  lobby.team2 = lobby.team2.filter((p) => p.ready);

  // Either team below floor → cancel
  if (
    lobby.team1.length < MIN_TEAM_SIZE ||
    lobby.team2.length < MIN_TEAM_SIZE
  ) {
    await cancelLobby(
      lobby,
      `not enough ready players (T1: ${lobby.team1.length}, T2: ${lobby.team2.length}, min ${MIN_TEAM_SIZE} per side) — ${afks.length} AFK penalised`,
    );
    return;
  }

  // Rebalance: trim the larger team to match the smaller, dropping
  // last-drafted players (no ELO penalty — they readied, just unlucky).
  // We delete their scrimmage_players row so the result pipeline ignores them.
  if (lobby.team1.length !== lobby.team2.length) {
    const beforeIds = new Set(
      [...lobby.team1, ...lobby.team2].map((p) => p.playerId),
    );
    if (lobby.team1.length > lobby.team2.length) {
      lobby.team1 = trimToSize(lobby.team1, lobby.team2.length);
    } else {
      lobby.team2 = trimToSize(lobby.team2, lobby.team1.length);
    }
    const afterIds = new Set(
      [...lobby.team1, ...lobby.team2].map((p) => p.playerId),
    );
    const benched = [...beforeIds].filter((id) => !afterIds.has(id));
    for (const playerId of benched) {
      try {
        await removeBenchedPlayer(supabase, {
          matchId: lobby.matchId,
          playerId,
        });
      } catch (err) {
        console.error("[scrimmage] removeBenchedPlayer failed:", err);
      }
    }
  }

  await goLive(lobby);
}

/* ------------------------------------------------------------------ */
/*  Go live                                                           */
/* ------------------------------------------------------------------ */

async function goLive(lobby: ActiveLobby): Promise<void> {
  clearTimers(lobby);
  lobby.phase = "live";
  lobby.liveStartedAt = Date.now();

  try {
    await updateScrimmageMatchStatus(
      createBotSupabase(),
      lobby.matchId,
      "live",
      {
        match_started_at: new Date().toISOString(),
      },
    );
  } catch (err) {
    console.error("[scrimmage] goLive status update failed:", err);
  }

  try {
    const msg = await lobby.channel.messages
      .fetch(lobby.messageId)
      .catch(() => null);
    if (msg) {
      await msg.edit({
        content: "",
        embeds: [renderLiveEmbed(lobby)],
        components: [],
      });
    }
  } catch (err) {
    console.error("[scrimmage] goLive card edit failed:", err);
  }

  // Note: we keep the in-memory lobby alive while the match is live so
  // future-pings / re-entry could find it. A bot restart loses it; the
  // canonical data lives in scrimmage_matches + scrimmage_players, and
  // /scrimmage report works purely from the DB.
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

function trimToSize(team: DraftedPlayer[], size: number): DraftedPlayer[] {
  if (team.length <= size) return team;
  // Keep captains (pickOrder=0) + earliest-pick draft picks
  const captain = team.find((p) => p.pickOrder === 0);
  const drafted = team
    .filter((p) => p.pickOrder !== 0)
    .sort((a, b) => a.pickOrder - b.pickOrder);
  const keptDrafted = drafted.slice(0, Math.max(0, size - 1));
  return captain ? [captain, ...keptDrafted] : keptDrafted;
}

/* ------------------------------------------------------------------ */
/*  Renderers                                                         */
/* ------------------------------------------------------------------ */

async function editReadyCard(lobby: ActiveLobby): Promise<void> {
  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(SCR_BTN_READY)
      .setLabel("Ready up")
      .setStyle(ButtonStyle.Success)
      .setEmoji("✅"),
  );

  try {
    const msg = await lobby.channel.messages
      .fetch(lobby.messageId)
      .catch(() => null);
    if (!msg) return;
    await msg.edit({
      content: "",
      embeds: [renderReadyEmbed(lobby)],
      components: [row],
    });
  } catch (err) {
    console.error("[scrimmage] editReadyCard failed:", err);
  }
}

function renderReadyEmbed(lobby: ActiveLobby): EmbedBuilder {
  const all = [...lobby.team1, ...lobby.team2];
  const ready = all.filter((p) => p.ready).length;
  const total = all.length;
  const deadlineUnix = Math.floor(lobby.readyDeadline / 1000);

  const renderTeam = (team: DraftedPlayer[]) =>
    team
      .map((p) => {
        const tag = p.pickOrder === 0 ? "👑" : `\`#${p.pickOrder}\``;
        const status = p.ready ? "✅" : "⏳";
        return `${status} ${tag} **${p.robloxUsername}** · ${p.preferredPosition}`;
      })
      .join("\n");

  return new EmbedBuilder()
    .setColor(ready === total ? COLOR_LIVE : COLOR_WARN)
    .setTitle(`⏱️ VF FACEIT · Ready check (${lobby.matchCode})`)
    .setDescription(
      [
        `**${ready}/${total}** players ready · expires <t:${deadlineUnix}:R>`,
        "",
        `❗ No-shows take **${NO_SHOW_PENALTY} ELO** and are removed from the match.`,
      ].join("\n"),
    )
    .addFields(
      {
        name: `🅰 Team 1 (${lobby.team1.length})`,
        value: renderTeam(lobby.team1) || "—",
        inline: true,
      },
      {
        name: `🅱 Team 2 (${lobby.team2.length})`,
        value: renderTeam(lobby.team2) || "—",
        inline: true,
      },
    )
    .setFooter({ text: "VF FACEIT · Click Ready to lock in." })
    .setTimestamp(new Date());
}

function renderLiveEmbed(lobby: ActiveLobby): EmbedBuilder {
  const renderTeam = (team: DraftedPlayer[]) =>
    team
      .map((p) => {
        const tag = p.pickOrder === 0 ? "👑" : `\`#${p.pickOrder}\``;
        return `${tag} **${p.robloxUsername}** · ${p.preferredPosition}`;
      })
      .join("\n");

  const c1 = lobby.captain1!;
  const c2 = lobby.captain2!;

  return new EmbedBuilder()
    .setColor(COLOR_BRAND)
    .setTitle(`🟢 VF FACEIT · LIVE · ${lobby.matchCode}`)
    .setDescription(
      [
        "**Match is live.** Play it out in Roblox.",
        "",
        `Either captain reports the result with **\`/scrimmage report <your-score> <opp-score>\`**.`,
        `The other captain has **2 minutes** to confirm or dispute.`,
      ].join("\n"),
    )
    .addFields(
      {
        name: `🅰 Team 1 · ${c1.robloxUsername}`,
        value: renderTeam(lobby.team1) || "—",
        inline: true,
      },
      {
        name: `🅱 Team 2 · ${c2.robloxUsername}`,
        value: renderTeam(lobby.team2) || "—",
        inline: true,
      },
    )
    .setFooter({
      text: "VF FACEIT · Confirm → ELO updates apply · Dispute → admin review.",
    })
    .setTimestamp(new Date());
}
