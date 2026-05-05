/**
 * Phase 2 + 3 — Captain Selection + Snake Draft.
 *
 * Captains are the top 2 ELO in the queue (tiebreaker = earliest joinedAt).
 * Pick order:
 *   #1 → Captain 1
 *   #2 → Captain 2 (compensatory)
 *   #3 → Captain 2
 *   #4..N → alternating C1, C2, C1, C2, ...
 *
 * Each pick has a 30s timer. If the active captain doesn't pick in time we
 * auto-pick the highest-ELO remaining player. The card edits on every pick.
 *
 * On the last pick, we hand off to ready.startReadyCheck().
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
  insertCaptainPlayer,
  insertDraftedPlayer,
  updateScrimmageMatchStatus,
} from "@/bot/scrimmage/db";
import {
  clearTimers,
  getActiveLobby,
  type ActiveLobby,
  type DraftedPlayer,
} from "@/bot/scrimmage/state";
import { startReadyCheck } from "@/bot/scrimmage/ready";

const COLOR_BRAND = 0x083696;

export const PICK_TIMER_MS = 30 * 1000;
export const POST_QUEUE_DELAY_MS = 10 * 1000; // brief breath between phases
export const SCR_BTN_PICK_PREFIX = "vfl:scr:pick:";

/* ------------------------------------------------------------------ */
/*  Entry point — called by queue.ts when the queue closes            */
/* ------------------------------------------------------------------ */

export async function startDraft(lobby: ActiveLobby): Promise<void> {
  clearTimers(lobby);
  lobby.phase = "drafting";

  // Captains: top 2 by ELO, tiebreaker = earliest joined
  const sorted = [...lobby.queue].sort((a, b) => {
    if (b.elo !== a.elo) return b.elo - a.elo;
    return a.joinedAt - b.joinedAt;
  });
  const c1Q = sorted[0];
  const c2Q = sorted[1];
  if (!c1Q || !c2Q) {
    throw new Error("Not enough players to select captains");
  }

  const captain1: DraftedPlayer = {
    ...c1Q,
    team: 1,
    pickOrder: 0,
    ready: false,
  };
  const captain2: DraftedPlayer = {
    ...c2Q,
    team: 2,
    pickOrder: 0,
    ready: false,
  };
  lobby.captain1 = captain1;
  lobby.captain2 = captain2;
  lobby.team1 = [captain1];
  lobby.team2 = [captain2];

  // Remaining players go into the draft pool
  lobby.draftPool = lobby.queue.filter(
    (p) => p.discordId !== c1Q.discordId && p.discordId !== c2Q.discordId,
  );

  // Build the pick order: C1, C2, C2, then alternating C1, C2, ...
  lobby.pickQueue = buildPickOrder(lobby.draftPool.length);
  lobby.pickIndex = 0;

  const supabase = createBotSupabase();

  // Persist captains + match transition
  try {
    await updateScrimmageMatchStatus(supabase, lobby.matchId, "drafting", {
      team1_captain_id: captain1.playerId,
      team2_captain_id: captain2.playerId,
      player_count: lobby.queue.length,
      draft_started_at: new Date().toISOString(),
    });
    await insertCaptainPlayer(supabase, {
      matchId: lobby.matchId,
      playerId: captain1.playerId,
      team: 1,
      eloBefore: captain1.elo,
      preferredPosition: captain1.preferredPosition,
    });
    await insertCaptainPlayer(supabase, {
      matchId: lobby.matchId,
      playerId: captain2.playerId,
      team: 2,
      eloBefore: captain2.elo,
      preferredPosition: captain2.preferredPosition,
    });
  } catch (err) {
    console.error("[scrimmage] startDraft persist failed:", err);
    throw err;
  }

  // Brief intro card before the pick countdown begins
  await editDraftCard(lobby, {
    intro: true,
    introCountdownDeadline: Date.now() + POST_QUEUE_DELAY_MS,
  });

  // Schedule the first pick after the intro delay
  lobby.timers.queueExpire = setTimeout(() => {
    void beginNextPick(lobby).catch((err) =>
      console.error("[scrimmage] beginNextPick failed:", err),
    );
  }, POST_QUEUE_DELAY_MS);
}

/* ------------------------------------------------------------------ */
/*  Pick flow                                                         */
/* ------------------------------------------------------------------ */

async function beginNextPick(lobby: ActiveLobby): Promise<void> {
  if (lobby.phase !== "drafting") return;

  if (lobby.pickIndex >= lobby.pickQueue.length || lobby.draftPool.length === 0) {
    // Draft done — hand off to ready check
    await startReadyCheck(lobby).catch((err) =>
      console.error("[scrimmage] startReadyCheck failed:", err),
    );
    return;
  }

  lobby.pickDeadline = Date.now() + PICK_TIMER_MS;
  await editDraftCard(lobby, { intro: false });

  // Auto-pick if the active captain doesn't click in time
  lobby.timers.pickExpire = setTimeout(() => {
    void autoPickHighestElo(lobby).catch((err) =>
      console.error("[scrimmage] autoPickHighestElo failed:", err),
    );
  }, PICK_TIMER_MS);
}

export async function handlePickButton(
  interaction: ButtonInteraction,
  pickedDiscordId: string,
): Promise<void> {
  const lobby = getActiveLobby();
  if (!lobby || lobby.phase !== "drafting") {
    await interaction.reply({
      flags: 1 << 6,
      content: "There’s no active draft right now.",
    });
    return;
  }

  const activeTeam = currentTeam(lobby);
  const activeCaptain =
    activeTeam === 1 ? lobby.captain1 : lobby.captain2;
  if (!activeCaptain || activeCaptain.discordId !== interaction.user.id) {
    await interaction.reply({
      flags: 1 << 6,
      content: `Only **${activeCaptain?.robloxUsername ?? "the active captain"}** can pick right now.`,
    });
    return;
  }

  const idx = lobby.draftPool.findIndex(
    (p) => p.discordId === pickedDiscordId,
  );
  if (idx === -1) {
    await interaction.reply({
      flags: 1 << 6,
      content: "That player is no longer in the draft pool.",
    });
    return;
  }

  await interaction.deferUpdate();
  await applyPick(lobby, idx);
  await afterPick(lobby);
}

/** Auto-pick: highest ELO in pool, tiebreaker first joined. */
async function autoPickHighestElo(lobby: ActiveLobby): Promise<void> {
  if (lobby.phase !== "drafting" || lobby.draftPool.length === 0) return;
  const sorted = [...lobby.draftPool].sort((a, b) => {
    if (b.elo !== a.elo) return b.elo - a.elo;
    return a.joinedAt - b.joinedAt;
  });
  const top = sorted[0];
  if (!top) return;
  const idx = lobby.draftPool.findIndex((p) => p.discordId === top.discordId);
  if (idx === -1) return;
  await applyPick(lobby, idx);
  await afterPick(lobby);
}

async function applyPick(lobby: ActiveLobby, poolIndex: number): Promise<void> {
  const player = lobby.draftPool.splice(poolIndex, 1)[0];
  if (!player) return;

  const team = currentTeam(lobby);
  // pick_order: 1-based position in the draft (post-captain).
  const pickOrder = lobby.pickIndex + 1;
  const drafted: DraftedPlayer = {
    ...player,
    team,
    pickOrder,
    ready: false,
  };
  if (team === 1) lobby.team1.push(drafted);
  else lobby.team2.push(drafted);
  lobby.pickIndex += 1;

  try {
    await insertDraftedPlayer(createBotSupabase(), {
      matchId: lobby.matchId,
      playerId: player.playerId,
      team,
      pickOrder,
      eloBefore: player.elo,
      preferredPosition: player.preferredPosition,
    });
  } catch (err) {
    console.error("[scrimmage] insertDraftedPlayer failed:", err);
  }
}

async function afterPick(lobby: ActiveLobby): Promise<void> {
  if (lobby.timers.pickExpire) {
    clearTimeout(lobby.timers.pickExpire);
    lobby.timers.pickExpire = undefined;
  }
  await beginNextPick(lobby);
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

function currentTeam(lobby: ActiveLobby): 1 | 2 {
  const slot = lobby.pickQueue[lobby.pickIndex];
  return slot ?? 1;
}

/**
 * Build the pick order: C1, C2, C2, then alternating C1, C2, ...
 * Returns a vector of length `playersToDraft`.
 */
export function buildPickOrder(playersToDraft: number): (1 | 2)[] {
  const order: (1 | 2)[] = [];
  let p = 0;
  if (p < playersToDraft) {
    order.push(1);
    p++;
  }
  if (p < playersToDraft) {
    order.push(2);
    p++;
  }
  if (p < playersToDraft) {
    order.push(2);
    p++;
  }
  let next: 1 | 2 = 1;
  while (p < playersToDraft) {
    order.push(next);
    next = next === 1 ? 2 : 1;
    p++;
  }
  return order;
}

/* ------------------------------------------------------------------ */
/*  Renderers                                                         */
/* ------------------------------------------------------------------ */

async function editDraftCard(
  lobby: ActiveLobby,
  args: { intro: boolean; introCountdownDeadline?: number },
): Promise<void> {
  try {
    const msg = await lobby.channel.messages
      .fetch(lobby.messageId)
      .catch(() => null);
    if (!msg) return;
    await msg.edit({
      content: "",
      embeds: [
        renderDraftEmbed(lobby, {
          intro: args.intro,
          introCountdownDeadline: args.introCountdownDeadline,
        }),
      ],
      components: args.intro ? [] : renderPickButtons(lobby),
    });
  } catch (err) {
    console.error("[scrimmage] editDraftCard failed:", err);
  }
}

function renderDraftEmbed(
  lobby: ActiveLobby,
  args: { intro: boolean; introCountdownDeadline?: number },
): EmbedBuilder {
  const c1 = lobby.captain1!;
  const c2 = lobby.captain2!;

  const team1Lines = renderTeamLines(lobby.team1);
  const team2Lines = renderTeamLines(lobby.team2);

  const activeTeam = currentTeam(lobby);
  const activeCaptain = activeTeam === 1 ? c1 : c2;
  const onTheClock = args.intro
    ? `Draft starts <t:${Math.floor((args.introCountdownDeadline ?? Date.now()) / 1000)}:R>`
    : `**${activeCaptain.robloxUsername}** is on the clock — picks <t:${Math.floor(lobby.pickDeadline / 1000)}:R>.`;

  const description = [
    `**${lobby.matchCode}** · Snake draft`,
    "",
    `🅰 **Team 1 captain** · <@${c1.discordId}> · 📈 ${c1.elo}`,
    `🅱 **Team 2 captain** · <@${c2.discordId}> · 📈 ${c2.elo}`,
    "",
    onTheClock,
  ].join("\n");

  const poolList =
    lobby.draftPool.length === 0
      ? "_All players drafted._"
      : lobby.draftPool
          .slice()
          .sort((a, b) => b.elo - a.elo)
          .map(
            (p) =>
              `**${p.robloxUsername}** · ${p.preferredPosition} · 📈 ${p.elo}`,
          )
          .join("\n");

  return new EmbedBuilder()
    .setColor(COLOR_BRAND)
    .setTitle(`🪙 VF FACEIT · Draft (${lobby.matchCode})`)
    .setDescription(description)
    .addFields(
      {
        name: `🅰 Team 1 (${lobby.team1.length})`,
        value: team1Lines || "—",
        inline: true,
      },
      {
        name: `🅱 Team 2 (${lobby.team2.length})`,
        value: team2Lines || "—",
        inline: true,
      },
      {
        name: `🎯 Available (${lobby.draftPool.length})`,
        value: poolList,
      },
    )
    .setFooter({
      text: "VF FACEIT · Auto-pick on timeout: highest available ELO.",
    })
    .setTimestamp(new Date());
}

function renderTeamLines(team: DraftedPlayer[]): string {
  return team
    .map((p) => {
      const tag = p.pickOrder === 0 ? "👑" : `\`#${p.pickOrder}\``;
      return `${tag}  **${p.robloxUsername}** · ${p.preferredPosition} · 📈 ${p.elo}`;
    })
    .join("\n");
}

/**
 * Render up to 5 buttons (one per available player), highest-ELO first.
 * Discord limits a row to 5 buttons + 5 rows max — we cap at 25 picks
 * which is far more than the 18-pick max for a 20-man scrimmage.
 */
export function renderPickButtons(
  lobby: ActiveLobby,
): ActionRowBuilder<ButtonBuilder>[] {
  const sorted = [...lobby.draftPool].sort((a, b) => {
    if (b.elo !== a.elo) return b.elo - a.elo;
    return a.joinedAt - b.joinedAt;
  });
  const rows: ActionRowBuilder<ButtonBuilder>[] = [];
  let row = new ActionRowBuilder<ButtonBuilder>();
  let count = 0;

  for (const p of sorted) {
    if (count > 0 && count % 5 === 0) {
      rows.push(row);
      row = new ActionRowBuilder<ButtonBuilder>();
      if (rows.length >= 5) break;
    }
    const label = `${p.robloxUsername} · ${p.elo}`;
    const truncated = label.length > 80 ? label.slice(0, 77) + "…" : label;
    row.addComponents(
      new ButtonBuilder()
        .setCustomId(`${SCR_BTN_PICK_PREFIX}${p.discordId}`)
        .setLabel(truncated)
        .setStyle(
          // Highlight the highest-ELO option as primary
          count === 0 ? ButtonStyle.Primary : ButtonStyle.Secondary,
        ),
    );
    count += 1;
  }
  if (row.components.length > 0 && rows.length < 5) rows.push(row);
  return rows;
}
