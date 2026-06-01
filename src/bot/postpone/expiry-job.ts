import type { Client } from "discord.js";

import {
  processExpiredPostponementRequest,
  processStaffPostponementPing,
} from "@/bot/postpone/handlers";
import {
  fetchEscalationsNeedingStaffPing,
  fetchExpiredPendingRequests,
} from "@/bot/postpone/queries";
import { createBotSupabase } from "@/bot/stats-queries";

const TICK_MS = 5 * 60 * 1000;

export async function runPostponementSweep(client: Client): Promise<void> {
  const supabase = createBotSupabase();

  const expired = await fetchExpiredPendingRequests(supabase);
  for (const row of expired) {
    await processExpiredPostponementRequest(client, row);
  }

  const pingDue = await fetchEscalationsNeedingStaffPing(supabase);
  for (const row of pingDue) {
    await processStaffPostponementPing(client, row);
  }

  if (expired.length > 0 || pingDue.length > 0) {
    console.log(
      `[postpone-sweep] expired=${expired.length} staff_ping=${pingDue.length}`,
    );
  }
}

export function schedulePostponementJob(client: Client): void {
  void runPostponementSweep(client).catch((e) => {
    console.error("[postpone-sweep] initial run:", e);
  });

  setInterval(() => {
    void runPostponementSweep(client).catch((e) => {
      console.error("[postpone-sweep] tick:", e);
    });
  }, TICK_MS);
}
