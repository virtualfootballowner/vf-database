import type { Client } from "discord.js";

import {
  refereeAssignmentsChannelId,
  refereeGuildId,
  refereeRoleId,
} from "@/bot/referees/config";
import {
  buildUnclaimedAssignmentEmbed,
  buildUnclaimedAssignmentPingContent,
} from "@/bot/referees/unclaimed-alerts/messages";
import {
  claimUnclaimedAlertSlot,
  fetchUnclaimedAssignmentsFor24hWindow,
  releaseUnclaimedAlertSlot,
} from "@/bot/referees/unclaimed-alerts/queries";
import { createBotSupabase } from "@/bot/stats-queries";

const TICK_MS = 5 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;
const LOOKAHEAD_MS = 25 * HOUR_MS;
const WINDOW_MS = TICK_MS;

function msUntilKickoff(scheduledAt: string): number {
  return new Date(scheduledAt).getTime() - Date.now();
}

function alertDue24h(msUntil: number): boolean {
  const offset = 24 * HOUR_MS;
  return msUntil <= offset + WINDOW_MS && msUntil >= offset - WINDOW_MS;
}

export async function runRefereeUnclaimedAlertSweep(
  client: Client,
): Promise<void> {
  const channelId = refereeAssignmentsChannelId();
  if (!channelId) return;

  let channel;
  try {
    const ch = await client.channels.fetch(channelId);
    if (!ch?.isTextBased() || !ch.isSendable()) return;
    channel = ch;
  } catch {
    console.error("[referee-unclaimed] could not fetch assignments channel");
    return;
  }

  const supabase = createBotSupabase();
  const rows = await fetchUnclaimedAssignmentsFor24hWindow(
    supabase,
    LOOKAHEAD_MS,
  );

  const guildId = refereeGuildId();
  const roleId = refereeRoleId();
  let sent = 0;

  for (const row of rows) {
    const msUntil = msUntilKickoff(row.scheduled_at);
    if (!alertDue24h(msUntil)) continue;

    const claimed = await claimUnclaimedAlertSlot(supabase, row.assignment_id);
    if (!claimed) continue;

    const embed = buildUnclaimedAssignmentEmbed(row);
    const content = buildUnclaimedAssignmentPingContent(row, roleId, guildId);

    try {
      await channel.send({
        content,
        embeds: [embed],
        allowedMentions: { roles: [roleId] },
      });
      sent += 1;
      console.log(
        `[referee-unclaimed] 24h alert for assignment ${row.assignment_id.slice(0, 8)}…`,
      );
    } catch (err) {
      await releaseUnclaimedAlertSlot(supabase, row.assignment_id);
      console.error(
        `[referee-unclaimed] channel send failed ${row.assignment_id}:`,
        err,
      );
    }
  }

  if (sent > 0) {
    console.log(`[referee-unclaimed] posted ${sent} alert(s)`);
  }
}

export function scheduleRefereeUnclaimedAlertJob(client: Client): void {
  void runRefereeUnclaimedAlertSweep(client).catch((e) => {
    console.error("[referee-unclaimed] initial run:", e);
  });

  setInterval(() => {
    void runRefereeUnclaimedAlertSweep(client).catch((e) => {
      console.error("[referee-unclaimed] tick:", e);
    });
  }, TICK_MS);
}
