/**
 * Phase 1 — Queue.
 *
 * Lifecycle:
 *  - `/scrimmage start` posts the lobby card in #scrimmage-lobby and seeds
 *    a `scrimmage_matches` row (status=queuing). The host auto-joins.
 *  - JOIN button → opens a position modal → submitting it adds the player
 *    to the in-memory queue (we don't write `scrimmage_players` yet because
 *    the table requires team ∈ {1,2}).
 *  - LEAVE button → removes from queue.
 *  - 5-min auto-progress: if 16+ players, hand off to draft.startDraft.
 *    Otherwise cancel the lobby.
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
  ModalBuilder,
  TextChannel,
  TextInputBuilder,
  TextInputStyle,
  type ButtonInteraction,
  type ChatInputCommandInteraction,
  type ModalSubmitInteraction,
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

export const SCR_BTN_JOIN = "vfl:scr:join";
export const SCR_BTN_LEAVE = "vfl:scr:leave";
export const SCR_MODAL_POSITION = "vfl:scr:posmod";
export const SCR_MODAL_INPUT = "vfl:scr:posinput";

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

  // Singleton check
  if (getActiveLobby()) {
    await interaction.reply({
      flags: MessageFlags.Ephemeral,
      content:
        "⛳ A scrimmage is already in progress. Use **`/scrimmage cancel`** if you’re the host or wait for it to finish.",
    });
    return;
  }

  const supabase = createBotSupabase();

  // Belt-and-braces — also check the DB in case in-memory state got nuked but
  // an old match row is still in a non-terminal status.
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

  // Seed in-memory lobby with the host already queued (the spec implies the
  // host auto-joins; they can /leave if they don't want to play).
  const hostRating = await ensureScrimmageRating(supabase, hostPlayerId);
  const hostQueued: QueuedPlayer = {
    discordId: interaction.user.id,
    playerId: hostPlayerId,
    robloxUsername: hostUsername,
    preferredPosition: "—",
    elo: hostRating.elo,
    joinedAt: Date.now(),
  };

  const lobby: ActiveLobby = {
    matchId: matchRow.id,
    matchCode: matchRow.matchCode,
    hostDiscordId: interaction.user.id,
    hostPlayerId,
    hostUsername,
    channel: lobbyChannel,
    messageId: "", // filled below
    phase: "queuing",
    queue: [hostQueued],
    queueDeadline: Date.now() + QUEUE_DURATION_MS,
    team1: [],
    team2: [],
    pickQueue: [],
    pickIndex: 0,
    pickDeadline: 0,
    draftPool: [],
    readyDeadline: 0,
    liveStartedAt: null,
    timers: {},
  };

  // Post the queue card
  let posted;
  try {
    posted = await lobbyChannel.send({
      content: "@here **Scrimmage queue is open!**",
      embeds: [renderQueueEmbed(lobby)],
      components: [renderQueueButtons()],
    });
  } catch (err) {
    console.error("[scrimmage] lobby card send failed:", err);
    await interaction.editReply({
      content:
        "❌ Couldn’t post the lobby card. Make sure I have **Send Messages** + **Embed Links** in the lobby channel.",
    });
    // Best-effort cleanup — the match row is orphaned. We mark it cancelled.
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

  // 5-minute auto-progress / auto-cancel timer
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
/*  JOIN button → modal                                               */
/* ------------------------------------------------------------------ */

export async function handleJoinButton(
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

  if (lobby.queue.length >= MAX_PLAYERS) {
    await interaction.reply({
      flags: MessageFlags.Ephemeral,
      content: `Queue is full (${MAX_PLAYERS}/${MAX_PLAYERS}). The draft starts at the deadline.`,
    });
    return;
  }

  if (lobby.queue.some((p) => p.discordId === interaction.user.id)) {
    await interaction.reply({
      flags: MessageFlags.Ephemeral,
      content: "You’re already in the queue.",
    });
    return;
  }

  // Enforce whitelist on the JOIN click too — non-whitelisted users shouldn't
  // be able to just push the button in #scrimmage-lobby.
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

  // Show position modal — actual queue insert happens on submit.
  const modal = new ModalBuilder()
    .setCustomId(SCR_MODAL_POSITION)
    .setTitle("Join scrimmage queue")
    .addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId(SCR_MODAL_INPUT)
          .setLabel("Preferred position (e.g. ST, CB, GK)")
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setMinLength(1)
          .setMaxLength(20),
      ),
    );

  await interaction.showModal(modal);
}

/* ------------------------------------------------------------------ */
/*  Position modal submit                                             */
/* ------------------------------------------------------------------ */

export async function handlePositionModal(
  interaction: ModalSubmitInteraction,
): Promise<void> {
  const lobby = getActiveLobby();
  if (!lobby || lobby.phase !== "queuing") {
    await interaction.reply({
      flags: MessageFlags.Ephemeral,
      content: "The queue closed before your submission landed.",
    });
    return;
  }

  if (lobby.queue.some((p) => p.discordId === interaction.user.id)) {
    await interaction.reply({
      flags: MessageFlags.Ephemeral,
      content: "You’re already in the queue.",
    });
    return;
  }

  if (lobby.queue.length >= MAX_PLAYERS) {
    await interaction.reply({
      flags: MessageFlags.Ephemeral,
      content: "Queue filled up just before your submission.",
    });
    return;
  }

  const positionRaw = interaction.fields
    .getTextInputValue(SCR_MODAL_INPUT)
    .trim()
    .toUpperCase();
  const position = positionRaw.length > 20 ? positionRaw.slice(0, 20) : positionRaw;

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

  // Banned check — the spec mentions this; we already store ban_until.
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

  // Host or admin can cancel during queue/draft/ready_check.
  // Once `live`, only an admin can cancel via `/scrimmage void`.
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
        "Match is already live — use **`/scrimmage report`** when it ends or have an admin **`/scrimmage void`** it.",
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

  // Cap at MAX_PLAYERS — spec says 16-20, anything past 20 doesn't fit
  // the snake-draft layout. Trim by joinedAt order.
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

/** Re-render the lobby card with the current queue state. */
async function editLobbyCard(lobby: ActiveLobby): Promise<void> {
  try {
    const msg = await lobby.channel.messages
      .fetch(lobby.messageId)
      .catch(() => null);
    if (!msg) return;
    await msg.edit({
      embeds: [renderQueueEmbed(lobby)],
      components: [renderQueueButtons()],
    });
  } catch (err) {
    console.error("[scrimmage] editLobbyCard failed:", err);
  }
}

/* ------------------------------------------------------------------ */
/*  Renderers                                                         */
/* ------------------------------------------------------------------ */

export function renderQueueButtons(): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(SCR_BTN_JOIN)
      .setLabel("Join Queue")
      .setStyle(ButtonStyle.Success)
      .setEmoji("✅"),
    new ButtonBuilder()
      .setCustomId(SCR_BTN_LEAVE)
      .setLabel("Leave Queue")
      .setStyle(ButtonStyle.Secondary)
      .setEmoji("🚪"),
  );
}

function renderQueueEmbed(lobby: ActiveLobby): EmbedBuilder {
  const deadlineUnix = Math.floor(lobby.queueDeadline / 1000);
  const queueList =
    lobby.queue.length === 0
      ? "_No players yet — be the first to join._"
      : lobby.queue
          .map((p, i) => {
            const num = String(i + 1).padStart(2, " ");
            const tag = p.discordId === lobby.hostDiscordId ? " · *host*" : "";
            return `\`${num}\`  **${p.robloxUsername}** · ${p.preferredPosition} · 📈 ${p.elo}${tag}`;
          })
          .join("\n");

  return new EmbedBuilder()
    .setColor(COLOR_BRAND)
    .setTitle(`🎮 VF FACEIT · Scrimmage Queue (${lobby.matchCode})`)
    .setDescription(
      [
        `**Host** · <@${lobby.hostDiscordId}>`,
        `**Closes** · <t:${deadlineUnix}:R> · <t:${deadlineUnix}:t>`,
        "",
        `Click **Join Queue** to drop in. We need **${MIN_PLAYERS}–${MAX_PLAYERS}** players for the draft.`,
      ].join("\n"),
    )
    .addFields({
      name: `🪪 Players (${lobby.queue.length}/${MAX_PLAYERS})`,
      value: queueList,
    })
    .setFooter({
      text: "VF FACEIT · You can leave anytime before the queue closes.",
    })
    .setTimestamp(new Date());
}

