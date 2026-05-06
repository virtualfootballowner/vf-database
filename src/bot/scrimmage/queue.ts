/**
 * Phase 1 — Queue.
 *
 * Lifecycle:
 *  - `/scrimmage start` posts the lobby card in #scrimmage-lobby and seeds
 *    a `scrimmage_matches` row (status=queuing). The host does NOT auto-join
 *    — they pick their position from the dropdown like everyone else.
 *  - Position dropdown → adds the player to the in-memory queue (the
 *    `scrimmage_players` table requires team ∈ {1,2} so we can't write
 *    rows yet — happens at draft time).
 *  - LEAVE button → removes from queue.
 *  - Position quotas:
 *      Min (must be met at draft start): 1 GK, 2 CB, 2 CM, 2 ST.
 *      Max (rejected on join): see SCRIMMAGE_POSITION_MAX below.
 *  - 5-min auto-progress: if 16+ players AND min quotas met, hand off to
 *    draft.startDraft. Otherwise cancel with a helpful reason.
 *  - `/scrimmage cancel` (host only) — clears state immediately.
 *
 * Card edits are rare — we only re-render on JOIN/LEAVE. The deadline
 * countdown uses Discord's `<t:UNIX:R>` relative timestamp so it animates
 * client-side without us ever editing the message.
 */

import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  MessageFlags,
  StringSelectMenuBuilder,
  TextChannel,
  type ChatInputCommandInteraction,
  type StringSelectMenuInteraction,
  type ButtonInteraction,
} from "discord.js";

import { env } from "@/bot/config";
import { createBotSupabase } from "@/bot/stats-queries";
import { startDraft } from "@/bot/scrimmage/draft";
import {
  createScrimmageMatch,
  ensureScrimmageRating,
  fetchActiveScrimmageMatch,
  setScrimmageMatchMessageId,
  updateScrimmageMatchStatus,
} from "@/bot/scrimmage/db";
import {
  getActiveLobby,
  setActiveLobby,
  type ActiveLobby,
  type QueuedPlayer,
} from "@/bot/scrimmage/state";
import { cancelLobby } from "@/bot/scrimmage/lifecycle";
import { isWhitelistedForScrimmage } from "@/bot/scrimmage/permissions";

/* ------------------------------------------------------------------ */
/*  Constants — tweak these in one place                              */
/* ------------------------------------------------------------------ */

export const QUEUE_DURATION_MS = 5 * 60 * 1000; // 5 min
export const MIN_PLAYERS = 16;
export const MAX_PLAYERS = 20;

const COLOR_BRAND = 0x083696;

export const SCR_BTN_LEAVE = "vfl:scr:leave";
export const SCR_SELECT_JOIN = "vfl:scr:joinpos";

/**
 * Fixed position list shown in the join dropdown. Keep this short — it's
 * a single Discord StringSelect with a 25-option ceiling, but more options
 * = decision fatigue. Six covers the common 8v8 footy roles.
 */
export const SCRIMMAGE_POSITIONS = [
  { code: "GK", label: "Goalkeeper", emoji: "🧤" },
  { code: "CB", label: "Center Back", emoji: "🛡️" },
  { code: "FB", label: "Fullback (LB / RB)", emoji: "🪜" },
  { code: "CM", label: "Center Mid", emoji: "🎯" },
  { code: "CAM", label: "Attacking Mid", emoji: "🪄" },
  { code: "ST", label: "Striker", emoji: "⚽" },
] as const;

export type ScrimmagePositionCode = (typeof SCRIMMAGE_POSITIONS)[number]["code"];

const POSITION_CODE_SET = new Set<ScrimmagePositionCode>(
  SCRIMMAGE_POSITIONS.map((p) => p.code),
);

/**
 * Minimum number of each position the queue must hold when the timer ends
 * for the draft to proceed. Anything not listed = no minimum.
 */
export const SCRIMMAGE_POSITION_MIN: Record<ScrimmagePositionCode, number> = {
  GK: 1,
  CB: 2,
  FB: 0,
  CM: 2,
  CAM: 0,
  ST: 2,
};

/**
 * Maximum number of each position that can be queued at once. Click on a
 * full position is rejected with an ephemeral notice. Tuned for a 16-20
 * man roster — leaves headroom on the flex positions, caps the rest.
 */
export const SCRIMMAGE_POSITION_MAX: Record<ScrimmagePositionCode, number> = {
  GK: 4,
  CB: 8,
  FB: 6,
  CM: 8,
  CAM: 6,
  ST: 4,
};

/* ------------------------------------------------------------------ */
/*  /scrimmage start                                                  */
/* ------------------------------------------------------------------ */

export async function handleScrimmageStart(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  if (!isWhitelistedForScrimmage(interaction)) {
    await interaction.reply({
      flags: MessageFlags.Ephemeral,
      content: "You need the **Whitelisted** role to start a scrimmage.",
    });
    return;
  }

  const lobbyChannelId = env.DISCORD_SCRIMMAGE_LOBBY_CHANNEL_ID;
  if (!lobbyChannelId) {
    await interaction.reply({
      flags: MessageFlags.Ephemeral,
      content:
        "❌ Scrimmage lobby channel isn’t configured yet — set `DISCORD_SCRIMMAGE_LOBBY_CHANNEL_ID` and restart the bot.",
    });
    return;
  }

  if (!interaction.guild) {
    await interaction.reply({
      flags: MessageFlags.Ephemeral,
      content: "Run this in the server, not in DMs.",
    });
    return;
  }

  if (getActiveLobby()) {
    await interaction.reply({
      flags: MessageFlags.Ephemeral,
      content:
        "⛳ A scrimmage is already in progress. Use **`/scrimmage cancel`** if you’re the host or wait for it to finish.",
    });
    return;
  }

  const supabase = createBotSupabase();

  try {
    const dbActive = await fetchActiveScrimmageMatch(supabase);
    if (dbActive) {
      await interaction.reply({
        flags: MessageFlags.Ephemeral,
        content:
          "⛳ A scrimmage is already on file (status: `" +
          dbActive.status +
          "`). Ask an admin to **/scrimmage void** it if it’s stuck.",
      });
      return;
    }
  } catch (err) {
    console.error("[scrimmage] active-match check failed:", err);
  }

  // Resolve host's player_id (must exist — they're already verified with the role).
  const { data: profile, error: profileErr } = await supabase
    .from("players")
    .select("id, roblox_username")
    .eq("discord_id", interaction.user.id)
    .maybeSingle();

  if (profileErr || !profile) {
    await interaction.reply({
      flags: MessageFlags.Ephemeral,
      content:
        "Couldn’t find your VF profile. Verify on the website first, then try again.",
    });
    return;
  }

  const hostPlayerId = (profile as { id: string }).id;
  const hostUsername =
    (profile as { roblox_username: string | null }).roblox_username ??
    interaction.user.username;

  // Resolve target channel
  let lobbyChannel: TextChannel;
  try {
    const fetched = await interaction.client.channels.fetch(lobbyChannelId);
    if (!fetched || !fetched.isTextBased() || !("send" in fetched)) {
      throw new Error("Lobby channel resolved but isn't a sendable text channel.");
    }
    lobbyChannel = fetched as TextChannel;
  } catch (err) {
    console.error("[scrimmage] lobby channel resolve failed:", err);
    await interaction.reply({
      flags: MessageFlags.Ephemeral,
      content:
        "❌ Couldn’t resolve the scrimmage lobby channel. Check `DISCORD_SCRIMMAGE_LOBBY_CHANNEL_ID` is correct.",
    });
    return;
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  let matchRow: { id: string; matchCode: string };
  try {
    matchRow = await createScrimmageMatch(supabase, {
      hostPlayerId,
      lobbyChannelId,
      lobbyMessageId: null,
    });
  } catch (err) {
    console.error("[scrimmage] createScrimmageMatch failed:", err);
    await interaction.editReply({
      content: "Couldn’t create the scrimmage match row. Try again.",
    });
    return;
  }

  // Host does not auto-queue — they have to pick their position from the
  // dropdown like everyone else. Cleaner and avoids the empty "—" position
  // that broke quota math previously.
  const lobby: ActiveLobby = {
    matchId: matchRow.id,
    matchCode: matchRow.matchCode,
    hostDiscordId: interaction.user.id,
    hostPlayerId,
    hostUsername,
    channel: lobbyChannel,
    messageId: "", // filled below
    phase: "queuing",
    queue: [],
    queueDeadline: Date.now() + QUEUE_DURATION_MS,
    team1: [],
    team2: [],
    pickQueue: [],
    pickIndex: 0,
    pickDeadline: 0,
    draftPool: [],
    readyDeadline: 0,
    liveStartedAt: null,
    robloxJoinLink: null,
    timers: {},
  };

  let posted;
  try {
    posted = await lobbyChannel.send({
      content: "@here **Scrimmage queue is open!**",
      embeds: [renderQueueEmbed(lobby)],
      components: renderQueueComponents(),
    });
  } catch (err) {
    console.error("[scrimmage] lobby card send failed:", err);
    await interaction.editReply({
      content:
        "❌ Couldn’t post the lobby card. Make sure I have **Send Messages** + **Embed Links** in the lobby channel.",
    });
    await safeMarkCancelled(matchRow.id, "lobby-card-send-failed");
    return;
  }

  lobby.messageId = posted.id;
  setActiveLobby(lobby);

  try {
    await setScrimmageMatchMessageId(supabase, matchRow.id, posted.id);
  } catch (err) {
    console.error("[scrimmage] setScrimmageMatchMessageId failed:", err);
  }

  lobby.timers.queueExpire = setTimeout(() => {
    void onQueueExpire(lobby.matchId).catch((err) =>
      console.error("[scrimmage] onQueueExpire failed:", err),
    );
  }, QUEUE_DURATION_MS);

  await interaction.editReply({
    content: `✅ Lobby created — ${posted.url}`,
  });
}

/* ------------------------------------------------------------------ */
/*  Position select → queue join                                      */
/* ------------------------------------------------------------------ */

export async function handleJoinSelect(
  interaction: StringSelectMenuInteraction,
): Promise<void> {
  const lobby = getActiveLobby();
  if (!lobby || lobby.phase !== "queuing") {
    await interaction.reply({
      flags: MessageFlags.Ephemeral,
      content: "There’s no open queue right now.",
    });
    return;
  }

  const raw = interaction.values[0];
  if (!raw || !POSITION_CODE_SET.has(raw as ScrimmagePositionCode)) {
    await interaction.reply({
      flags: MessageFlags.Ephemeral,
      content: "Pick a valid position from the dropdown.",
    });
    return;
  }
  const position = raw as ScrimmagePositionCode;

  // Whitelist gate — same one the slash command enforces.
  const member = interaction.member;
  const hasRole =
    !!member &&
    "roles" in member &&
    typeof (member.roles as { cache?: { has: (id: string) => boolean } })
      .cache?.has === "function" &&
    (member.roles as unknown as { cache: { has: (id: string) => boolean } })
      .cache.has(env.DISCORD_APPROVED_ROLE_ID);
  if (!hasRole) {
    await interaction.reply({
      flags: MessageFlags.Ephemeral,
      content: "You need the **Whitelisted** role to join scrimmages.",
    });
    return;
  }

  if (lobby.queue.some((p) => p.discordId === interaction.user.id)) {
    await interaction.reply({
      flags: MessageFlags.Ephemeral,
      content:
        "You’re already in the queue. Click **Leave Queue** first if you want to change position.",
    });
    return;
  }

  if (lobby.queue.length >= MAX_PLAYERS) {
    await interaction.reply({
      flags: MessageFlags.Ephemeral,
      content: `Queue is full (${MAX_PLAYERS}/${MAX_PLAYERS}).`,
    });
    return;
  }

  // Per-position cap
  const inPos = lobby.queue.filter(
    (p) => p.preferredPosition === position,
  ).length;
  const cap = SCRIMMAGE_POSITION_MAX[position];
  if (inPos >= cap) {
    await interaction.reply({
      flags: MessageFlags.Ephemeral,
      content: `**${position}** is full (${inPos}/${cap}). Pick a different position.`,
    });
    return;
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const supabase = createBotSupabase();
  const { data: profile, error: pErr } = await supabase
    .from("players")
    .select("id, roblox_username")
    .eq("discord_id", interaction.user.id)
    .maybeSingle();

  if (pErr || !profile) {
    await interaction.editReply({
      content:
        "Couldn’t find your VF profile. Verify on the website first, then try again.",
    });
    return;
  }

  const playerId = (profile as { id: string }).id;
  const robloxUsername =
    (profile as { roblox_username: string | null }).roblox_username ??
    interaction.user.username;

  const rating = await ensureScrimmageRating(supabase, playerId);

  if (rating.ban_until) {
    const ts = new Date(rating.ban_until).getTime();
    if (!Number.isNaN(ts) && ts > Date.now()) {
      await interaction.editReply({
        content: `🚫 You’re scrimmage-banned until <t:${Math.floor(ts / 1000)}:f>.`,
      });
      return;
    }
  }

  const queued: QueuedPlayer = {
    discordId: interaction.user.id,
    playerId,
    robloxUsername,
    preferredPosition: position,
    elo: rating.elo,
    joinedAt: Date.now(),
  };
  lobby.queue.push(queued);

  await editLobbyCard(lobby);

  await interaction.editReply({
    content: `✅ You’re in the queue as **${position}**. ELO ${rating.elo}.`,
  });
}

/* ------------------------------------------------------------------ */
/*  LEAVE button                                                      */
/* ------------------------------------------------------------------ */

export async function handleLeaveButton(
  interaction: ButtonInteraction,
): Promise<void> {
  const lobby = getActiveLobby();
  if (!lobby || lobby.phase !== "queuing") {
    await interaction.reply({
      flags: MessageFlags.Ephemeral,
      content: "There’s no open queue right now.",
    });
    return;
  }

  const idx = lobby.queue.findIndex(
    (p) => p.discordId === interaction.user.id,
  );
  if (idx === -1) {
    await interaction.reply({
      flags: MessageFlags.Ephemeral,
      content: "You’re not in the queue.",
    });
    return;
  }

  lobby.queue.splice(idx, 1);
  await editLobbyCard(lobby);

  await interaction.reply({
    flags: MessageFlags.Ephemeral,
    content: "👋 You’ve left the queue.",
  });
}

/* ------------------------------------------------------------------ */
/*  /scrimmage cancel                                                 */
/* ------------------------------------------------------------------ */

export async function handleScrimmageCancel(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  const lobby = getActiveLobby();
  if (!lobby) {
    await interaction.reply({
      flags: MessageFlags.Ephemeral,
      content: "No active scrimmage to cancel.",
    });
    return;
  }

  const isHost = lobby.hostDiscordId === interaction.user.id;
  if (!isHost) {
    await interaction.reply({
      flags: MessageFlags.Ephemeral,
      content: "Only the host can cancel a queue. Admins use **`/scrimmage void <code>`**.",
    });
    return;
  }
  if (lobby.phase === "live") {
    await interaction.reply({
      flags: MessageFlags.Ephemeral,
      content:
        "Match is already live — it auto-finalizes when the host runs `:fulltime` in Roblox. If it's stuck, ask an admin to **`/scrimmage void <code>`**.",
    });
    return;
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  await cancelLobby(lobby, "cancelled by host");
  await interaction.editReply({ content: "✅ Lobby cancelled." });
}

/* ------------------------------------------------------------------ */
/*  Internal — auto-progress when queue timer fires                   */
/* ------------------------------------------------------------------ */

async function onQueueExpire(matchId: string): Promise<void> {
  const lobby = getActiveLobby();
  if (!lobby || lobby.matchId !== matchId || lobby.phase !== "queuing") return;

  const playerCount = lobby.queue.length;
  if (playerCount < MIN_PLAYERS) {
    await cancelLobby(
      lobby,
      `not enough players (${playerCount}/${MIN_PLAYERS}) when queue closed`,
    );
    return;
  }

  // Position-quota check — must hit every minimum or we cancel.
  const missing = unmetPositionMinimums(lobby);
  if (missing.length > 0) {
    const summary = missing
      .map((m) => `${m.position} (have ${m.have}/${m.need})`)
      .join(", ");
    await cancelLobby(
      lobby,
      `position requirements not met — ${summary}`,
    );
    return;
  }

  if (lobby.queue.length > MAX_PLAYERS) {
    lobby.queue.sort((a, b) => a.joinedAt - b.joinedAt);
    lobby.queue = lobby.queue.slice(0, MAX_PLAYERS);
  }

  await startDraft(lobby).catch(async (err) => {
    console.error("[scrimmage] startDraft failed:", err);
    await cancelLobby(lobby, "draft setup failed");
  });
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

function unmetPositionMinimums(
  lobby: ActiveLobby,
): { position: ScrimmagePositionCode; need: number; have: number }[] {
  const out: { position: ScrimmagePositionCode; need: number; have: number }[] = [];
  for (const p of SCRIMMAGE_POSITIONS) {
    const need = SCRIMMAGE_POSITION_MIN[p.code];
    if (need <= 0) continue;
    const have = lobby.queue.filter((q) => q.preferredPosition === p.code).length;
    if (have < need) out.push({ position: p.code, need, have });
  }
  return out;
}

async function safeMarkCancelled(matchId: string, reason: string): Promise<void> {
  console.warn(`[scrimmage] marking ${matchId} cancelled: ${reason}`);
  try {
    await updateScrimmageMatchStatus(
      createBotSupabase(),
      matchId,
      "cancelled",
    );
  } catch (err) {
    console.error("[scrimmage] safeMarkCancelled failed:", err);
  }
}

async function editLobbyCard(lobby: ActiveLobby): Promise<void> {
  try {
    const msg = await lobby.channel.messages
      .fetch(lobby.messageId)
      .catch(() => null);
    if (!msg) return;
    await msg.edit({
      embeds: [renderQueueEmbed(lobby)],
      components: renderQueueComponents(),
    });
  } catch (err) {
    console.error("[scrimmage] editLobbyCard failed:", err);
  }
}

/* ------------------------------------------------------------------ */
/*  Renderers                                                         */
/* ------------------------------------------------------------------ */

export function renderQueueComponents(): (
  | ActionRowBuilder<StringSelectMenuBuilder>
  | ActionRowBuilder<ButtonBuilder>
)[] {
  const select = new StringSelectMenuBuilder()
    .setCustomId(SCR_SELECT_JOIN)
    .setPlaceholder("Join queue — choose your position")
    .setMinValues(1)
    .setMaxValues(1)
    .addOptions(
      SCRIMMAGE_POSITIONS.map((p) => ({
        label: `${p.code} · ${p.label}`,
        value: p.code,
        emoji: p.emoji,
      })),
    );

  const leave = new ButtonBuilder()
    .setCustomId(SCR_BTN_LEAVE)
    .setLabel("Leave Queue")
    .setStyle(ButtonStyle.Secondary)
    .setEmoji("🚪");

  return [
    new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select),
    new ActionRowBuilder<ButtonBuilder>().addComponents(leave),
  ];
}

function renderQueueEmbed(lobby: ActiveLobby): EmbedBuilder {
  const deadlineUnix = Math.floor(lobby.queueDeadline / 1000);
  const queueList =
    lobby.queue.length === 0
      ? "_No players yet — pick your position from the dropdown to join._"
      : lobby.queue
          .map((p, i) => {
            const num = String(i + 1).padStart(2, " ");
            const tag = p.discordId === lobby.hostDiscordId ? " · *host*" : "";
            return `\`${num}\`  **${p.robloxUsername}** · ${p.preferredPosition} · 📈 ${p.elo}${tag}`;
          })
          .join("\n");

  // Per-position summary: "GK 0/1 ⏳ · CB 1/2 ⏳ · ...".
  // Min ✓/⏳ shown for required positions; flex ones show count + cap.
  const positionSummary = SCRIMMAGE_POSITIONS.map((p) => {
    const have = lobby.queue.filter(
      (q) => q.preferredPosition === p.code,
    ).length;
    const min = SCRIMMAGE_POSITION_MIN[p.code];
    const max = SCRIMMAGE_POSITION_MAX[p.code];
    if (min > 0) {
      const status = have >= min ? "✅" : "⏳";
      return `${status} **${p.code}** ${have}/${min} *(cap ${max})*`;
    }
    return `**${p.code}** ${have} *(cap ${max})*`;
  }).join(" · ");

  return new EmbedBuilder()
    .setColor(COLOR_BRAND)
    .setTitle(`🎮 VF FACEIT · Scrimmage Queue (${lobby.matchCode})`)
    .setDescription(
      [
        `**Host** · <@${lobby.hostDiscordId}>`,
        `**Closes** · <t:${deadlineUnix}:R> · <t:${deadlineUnix}:t>`,
        "",
        `Pick a position from the dropdown to join. We need **${MIN_PLAYERS}–${MAX_PLAYERS}** players, and the queue must hit the position minimums (1 GK · 2 CB · 2 CM · 2 ST) by the deadline or it cancels.`,
      ].join("\n"),
    )
    .addFields(
      {
        name: `🪪 Players (${lobby.queue.length}/${MAX_PLAYERS})`,
        value: queueList,
      },
      {
        name: "📋 Positions",
        value: positionSummary,
      },
    )
    .setFooter({
      text: "VF FACEIT · Pick a position to join · Leave anytime before the deadline.",
    })
    .setTimestamp(new Date());
}
