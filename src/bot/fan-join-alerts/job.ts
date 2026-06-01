import type { Client, TextChannel } from "discord.js";

import {
  claimFanJoinAlertSlot,
  releaseFanJoinAlertSlot,
} from "@/bot/fan-join-alerts/queries";
import { buildFanJoinAlertMessage } from "@/bot/fan-join-alerts/messages";
import {
  fetchScheduledMatchesWithin,
  type ScheduledMatchReminderRow,
} from "@/bot/fixture-reminders/queries";
import { createBotSupabase } from "@/bot/stats-queries";

/** League server — fan watch-along / join channel. Override via env on Railway. */
const DEFAULT_FAN_JOIN_LEAGUE_CHANNEL_ID = "1511078239106367569";
/** VF Media server — fan engagement channel. Override via env on Railway. */
const DEFAULT_FAN_JOIN_MEDIA_CHANNEL_ID = "1511079063928836266";

const TICK_MS = 5 * 60 * 1000;
const TEN_MIN_MS = 10 * 60 * 1000;
/** Send when kickoff is within ±this window of 10 minutes out (matches fixture-reminder sweep). */
const WINDOW_MS = TICK_MS;
const LOOKAHEAD_MS = 20 * 60 * 1000;

function fanJoinChannelIds(): string[] {
  const league =
    process.env.DISCORD_FAN_JOIN_LEAGUE_CHANNEL_ID?.trim() ||
    DEFAULT_FAN_JOIN_LEAGUE_CHANNEL_ID;
  const media =
    process.env.DISCORD_FAN_JOIN_MEDIA_CHANNEL_ID?.trim() ||
    DEFAULT_FAN_JOIN_MEDIA_CHANNEL_ID;
  return [...new Set([league, media].filter(Boolean))];
}

function msUntilKickoff(scheduledAt: string): number {
  return new Date(scheduledAt).getTime() - Date.now();
}

function fanJoinDue(msUntil: number): boolean {
  return msUntil <= TEN_MIN_MS + WINDOW_MS && msUntil >= TEN_MIN_MS - WINDOW_MS;
}

async function resolveTextChannel(
  client: Client,
  channelId: string,
): Promise<TextChannel | null> {
  try {
    const channel = await client.channels.fetch(channelId);
    if (!channel?.isTextBased() || channel.isDMBased()) return null;
    if (!("send" in channel) || typeof channel.send !== "function") return null;
    return channel as TextChannel;
  } catch (err) {
    console.error(`[fan-join-alert] channel fetch ${channelId}:`, err);
    return null;
  }
}

async function postFanJoinAlert(
  client: Client,
  match: ScheduledMatchReminderRow,
  channelId: string,
): Promise<void> {
  const supabase = createBotSupabase();
  const claimed = await claimFanJoinAlertSlot(supabase, {
    matchId: match.id,
    channelId,
  });
  if (!claimed) return;

  const channel = await resolveTextChannel(client, channelId);
  if (!channel) {
    await releaseFanJoinAlertSlot(supabase, {
      matchId: match.id,
      channelId,
    });
    console.error(
      `[fan-join-alert] could not post — channel ${channelId} missing or not sendable`,
    );
    return;
  }

  const payload = buildFanJoinAlertMessage(match);

  try {
    await channel.send(payload);
    console.log(
      `[fan-join-alert] posted for ${match.home_slug} vs ${match.away_slug} in ${channelId}`,
    );
  } catch (err) {
    await releaseFanJoinAlertSlot(supabase, {
      matchId: match.id,
      channelId,
    });
    console.error(
      `[fan-join-alert] send failed ${channelId} match ${match.id}:`,
      err,
    );
  }
}

export async function runFanJoinAlertSweep(client: Client): Promise<void> {
  const channelIds = fanJoinChannelIds();
  if (channelIds.length === 0) return;

  const supabase = createBotSupabase();
  const matches = await fetchScheduledMatchesWithin(supabase, LOOKAHEAD_MS);
  const due = matches.filter((m) => fanJoinDue(msUntilKickoff(m.scheduled_at)));

  for (const match of due) {
    for (const channelId of channelIds) {
      await postFanJoinAlert(client, match, channelId);
    }
  }

  if (due.length > 0) {
    console.log(
      `[fan-join-alert] sweep posted checks for ${due.length} fixture(s) across ${channelIds.length} channel(s)`,
    );
  }
}

export function scheduleFanJoinAlertJob(client: Client): void {
  void runFanJoinAlertSweep(client).catch((e) => {
    console.error("[fan-join-alert] initial run:", e);
  });

  setInterval(() => {
    void runFanJoinAlertSweep(client).catch((e) => {
      console.error("[fan-join-alert] tick:", e);
    });
  }, TICK_MS);
}
