/**
 * In-memory state for the live scrimmage lobby.
 *
 * The bot only allows one active scrimmage at a time per spec
 * ("Only one lobby at a time"), so this is a process-local singleton.
 *
 * What's in-memory vs in-DB:
 *  - The DB stores canonical state for anything that has to survive a
 *    bot restart: the match row, every drafted player row, ELO ratings.
 *  - This file stores ephemeral state that's expensive to derive:
 *      - The queue (no scrimmage_players rows yet — team must be 1|2)
 *      - The active draft pick order + remaining undrafted queue
 *      - The set of "ready" players during ready check
 *      - All running setTimeout handles (queue/draft/ready/confirm) so
 *        a /scrimmage cancel can clear them.
 *  - On a bot restart in the middle of queue/draft/ready, the in-memory
 *    state is lost. Any active match row stuck in those statuses is
 *    cleaned up by `recoverStaleScrimmageMatches` at startup (see
 *    src/bot/scrimmage/handlers.ts).
 */

import type { TextChannel } from "discord.js";

export type ScrimmagePhase =
  | "queuing"
  | "drafting"
  | "ready_check"
  | "live";

/** A player who's clicked JOIN and submitted the position modal. */
export type QueuedPlayer = {
  /** Discord user id (snowflake). */
  discordId: string;
  /** UUID from `players.id`. */
  playerId: string;
  /** Display username — pulled from `players.roblox_username` for cards. */
  robloxUsername: string;
  /** Position they typed in the modal — keep as free text since the
   *  position list is long and we don't gate by it. */
  preferredPosition: string;
  /** Their current scrimmage ELO at queue-time. */
  elo: number;
  /** Used as a tiebreaker for captain selection. */
  joinedAt: number;
};

/** A drafted player on a team. Same shape as QueuedPlayer plus team data. */
export type DraftedPlayer = QueuedPlayer & {
  team: 1 | 2;
  /** 0 for captains; 1+ for picks. */
  pickOrder: number;
  /** Has the player clicked READY in the ready-check phase? */
  ready: boolean;
};

export type ActiveLobby = {
  matchId: string;
  matchCode: string;
  hostDiscordId: string;
  hostPlayerId: string;
  hostUsername: string;
  channel: TextChannel;
  /** Discord message id of the lobby card we keep editing across phases. */
  messageId: string;

  phase: ScrimmagePhase;

  /** Phase 1 — players waiting to be drafted. */
  queue: QueuedPlayer[];
  /** Wall-clock deadline (ms epoch) for the queue phase auto-progress. */
  queueDeadline: number;

  /** Phase 2/3 — captains + drafted players. */
  team1: DraftedPlayer[];
  team2: DraftedPlayer[];
  /** Captains aliased into the lobby for cheaper access. */
  captain1?: DraftedPlayer;
  captain2?: DraftedPlayer;
  /** Sequence of which captain picks next; consumed left-to-right. */
  pickQueue: (1 | 2)[];
  pickIndex: number;
  /** Wall-clock deadline (ms epoch) for the current pick. */
  pickDeadline: number;
  /** Snapshot of remaining queue players at draft-start. Modified as picks land. */
  draftPool: QueuedPlayer[];

  /** Phase 4 — ready-check deadline + per-player ready state. */
  readyDeadline: number;

  /** Set when match goes live. */
  liveStartedAt: number | null;

  /** All running timers — cleared on cancel/transition. */
  timers: {
    queueExpire?: ReturnType<typeof setTimeout>;
    queueTick?: ReturnType<typeof setInterval>;
    pickExpire?: ReturnType<typeof setTimeout>;
    pickTick?: ReturnType<typeof setInterval>;
    readyExpire?: ReturnType<typeof setTimeout>;
    readyTick?: ReturnType<typeof setInterval>;
  };
};

let activeLobby: ActiveLobby | null = null;

export function getActiveLobby(): ActiveLobby | null {
  return activeLobby;
}

export function setActiveLobby(lobby: ActiveLobby): void {
  activeLobby = lobby;
}

/**
 * Wipe the in-memory lobby + clear every timer attached to it.
 * Always call this when a match transitions to a terminal status
 * (completed / cancelled / voided / pending_confirmation hand-off).
 */
export function clearActiveLobby(): void {
  if (!activeLobby) return;
  for (const handle of Object.values(activeLobby.timers)) {
    if (handle) clearTimeout(handle);
  }
  activeLobby = null;
}

export function clearTimers(lobby: ActiveLobby): void {
  for (const key of Object.keys(lobby.timers) as (keyof ActiveLobby["timers"])[]) {
    const h = lobby.timers[key];
    if (h) {
      clearTimeout(h);
      // setInterval handles also belong to NodeJS.Timer; clearTimeout works
      // for both so we don't need to know which one this was.
      clearInterval(h as ReturnType<typeof setInterval>);
    }
    lobby.timers[key] = undefined;
  }
}
