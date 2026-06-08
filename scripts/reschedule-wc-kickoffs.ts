/**
 * Push S3 World Cup kickoffs from repo calendar into Supabase (matches + fixtures).
 * Safe for completed fixtures — only updates scheduled_at / metadata, not scores.
 *
 *   npx tsx scripts/reschedule-wc-kickoffs.ts
 */
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import path from "node:path";

import { buildS3WorldCupFixtureRows } from "../src/lib/s3-world-cup-fixtures";
import { buildAssignmentKickoffLabel } from "../src/bot/referees/assignments";

config({ path: path.resolve(process.cwd(), ".env.local"), override: true });

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main(): Promise<void> {
  const rows = buildS3WorldCupFixtureRows();
  let matchUpdates = 0;
  let fixtureUpdates = 0;

  for (const row of rows) {
    const code = row.roblox_match_id ?? row.fixture_code;
    const scheduledAt = String(row.metadata.scheduled_at ?? "");
    const calendarDate = String(row.metadata.calendar_date ?? "");
    if (!code || !scheduledAt) continue;

    const { data: match, error: mErr } = await supabase
      .from("matches")
      .select("id")
      .eq("roblox_match_id", code)
      .maybeSingle();
    if (mErr) throw mErr;

    if (match?.id) {
      const { error } = await supabase
        .from("matches")
        .update({ scheduled_at: scheduledAt })
        .eq("id", match.id);
      if (error) throw error;
      matchUpdates += 1;

      const kickoffLabel = buildAssignmentKickoffLabel(scheduledAt);
      for (const table of ["referee_assignments", "media_assignments"] as const) {
        await supabase
          .from(table)
          .update({ kickoff_label: kickoffLabel, updated_at: new Date().toISOString() })
          .eq("match_id", match.id)
          .in("status", ["open", "claimed"]);
      }

      await supabase
        .from("match_fan_join_channel_alerts")
        .delete()
        .eq("match_id", match.id);
    }

    const { data: fixture, error: fxGetErr } = await supabase
      .from("fixtures")
      .select("id, metadata")
      .eq("season", 3)
      .eq("competition", "World Cup")
      .eq("fixture_code", row.fixture_code)
      .maybeSingle();
    if (fxGetErr) throw fxGetErr;

    if (fixture?.id) {
      const prev =
        fixture.metadata &&
        typeof fixture.metadata === "object" &&
        !Array.isArray(fixture.metadata)
          ? (fixture.metadata as Record<string, unknown>)
          : {};
      const { error: fErr } = await supabase
        .from("fixtures")
        .update({
          metadata: {
            ...prev,
            scheduled_at: scheduledAt,
            calendar_date: calendarDate,
          },
        })
        .eq("id", fixture.id);
      if (fErr) throw fErr;
      fixtureUpdates += 1;
    }
  }

  const { error: tErr } = await supabase
    .from("tournaments")
    .update({ end_date: "2026-07-17" })
    .eq("season", 3)
    .eq("competition", "World Cup");
  if (tErr) throw tErr;

  console.log(
    `Rescheduled ${matchUpdates} matches, ${fixtureUpdates} fixtures; tournament end_date → 2026-07-17.`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
