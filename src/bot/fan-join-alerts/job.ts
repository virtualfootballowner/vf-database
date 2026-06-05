import type { Client, TextChannel } from "discord.js";

import { env } from "@/bot/config";
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

const TICK_MS = 5 * 60 * 1000;
/** Target ~10 minutes before kickoff, with a wide capture window so 5-minute sweeps do not miss fixtures. */
const TARGET_BEFORE_MS = 10 * 60 * 1000;
const WINDOW_MS = 8 * 60 * 1000;
const LOOKAHEAD_MS = 30 * 60 * 1000;

export function fanJoinChannelIds(): string[] {
  return [
    ...new Set(
      [
        env.DISCORD_FAN_JOIN_LEAGUE_CHANNEL_ID,
        env.DISCORD_FAN_JOIN_MEDIA_CHANNEL_ID,
      ].filter(Boolean),
    ),
  ];
}

function msUntilKickoff(scheduledAt: string): number {
  return new Date(scheduledAt).getTime() - Date.now();
}

export function fanJoinDue(msUntil: number): boolean {
  if (msUntil <= 0) return false;
  return (
    msUntil <= TARGET_BEFORE_MS + WINDOW_MS &&
    msUntil >= TARGET_BEFORE_MS - WINDOW_MS
  );
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
  let claimed = false;
  try {
    claimed = await claimFanJoinAlertSlot(supabase, {
      matchId: match.id,
      channelId,
    });
  } catch (err) {
    console.error(
      `[fan-join-alert] claim failed match ${match.id.slice(0, 8)}… channel ${channelId}:`,
      err,
    );
    return;
  }
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

  const minutesUntil = Math.max(
    1,
    Math.round(msUntilKickoff(match.scheduled_at) / 60_000),
  );
  const payload = buildFanJoinAlertMessage(match, minutesUntil);

  try {
    await channel.send({
      content: payload.content,
      embeds: [payload.embed],
      allowedMentions: { parse: ["everyone"] },
    });
    console.log(
      `[fan-join-alert] posted ${match.roblox_match_id ?? match.id.slice(0, 8)} (${match.home_slug} vs ${match.away_slug}) → ${channelId}`,
    );
  } catch (err) {
    await releaseFanJoinAlertSlot(supabase, {
      matchId: match.id,
      channelId,
    });
    console.error(
      `[fan-join-alert] send failed ${channelId} match ${match.roblox_match_id ?? match.id}:`,
      err,
    );
  }
}

export async function runFanJoinAlertSweep(client: Client): Promise<void> {
  const channelIds = fanJoinChannelIds();
  if (channelIds.length === 0) {
    console.warn("[fan-join-alert] no channels configured — alerts disabled");
    return;
  }

  const supabase = createBotSupabase();
  let matches;
  try {
    matches = await fetchScheduledMatchesWithin(supabase, LOOKAHEAD_MS);
  } catch (err) {
    console.error("[fan-join-alert] match fetch failed:", err);
    return;
  }

  const due = matches.filter((m) => fanJoinDue(msUntilKickoff(m.scheduled_at)));

  for (const match of due) {
    for (const channelId of channelIds) {
      try {
        await postFanJoinAlert(client, match, channelId);
      } catch (err) {
        console.error(
          `[fan-join-alert] unexpected error match ${match.id} channel ${channelId}:`,
          err,
        );
      }
    }
  }

  if (due.length > 0) {
    console.log(
      `[fan-join-alert] sweep: ${due.length} fixture(s) in alert window · ${channelIds.length} channel(s)`,
    );
  }
}

export function scheduleFanJoinAlertJob(client: Client): void {
  const channels = fanJoinChannelIds();
  console.log(
    `[fan-join-alert] scheduled every ${TICK_MS / 60_000}m · channels: ${channels.join(", ")} · window ${(TARGET_BEFORE_MS - WINDOW_MS) / 60_000}–${(TARGET_BEFORE_MS + WINDOW_MS) / 60_000} min before kickoff`,
  );

  void runFanJoinAlertSweep(client).catch((e) => {
    console.error("[fan-join-alert] initial run:", e);
  });

  setInterval(() => {
    void runFanJoinAlertSweep(client).catch((e) => {
      console.error("[fan-join-alert] tick:", e);
    });
  }, TICK_MS);
}
