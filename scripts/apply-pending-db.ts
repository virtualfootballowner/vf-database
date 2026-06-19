/**
 * Apply pending data + verify schema on production Supabase.
 *
 *   npx tsx scripts/apply-pending-db.ts
 */
import fs from "node:fs";
import path from "node:path";

import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

import { refreshTeamSeasonRecordsForSeason } from "../src/lib/league/team-season-records";

config({ path: path.resolve(process.cwd(), ".env.local"), override: true });

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required.");
  process.exit(1);
}

const supabase = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function applyArgentinaFft(): Promise<void> {
  const code = "S3-WC-G-D-04";
  const { data: match, error: mErr } = await supabase
    .from("matches")
    .select("id, home_score, away_score, fft")
    .eq("roblox_match_id", code)
    .maybeSingle();
  if (mErr) throw mErr;
  if (!match) {
    console.warn(`[apply] ${code} not found — skip`);
    return;
  }

  await supabase.from("match_events").delete().eq("match_id", match.id);

  const { data, error } = await supabase
    .from("matches")
    .update({
      home_score: 3,
      away_score: 0,
      status: "completed",
      fft: "Yes",
      ended_at: new Date().toISOString(),
    })
    .eq("roblox_match_id", code)
    .select("home_score, away_score, fft")
    .maybeSingle();
  if (error) throw error;
  console.log(`[apply] ${code}:`, data);
}

async function checkMatchAppearances(): Promise<void> {
  const { error } = await supabase.from("match_appearances").select("match_id").limit(1);
  if (error) {
    console.warn(
      "[apply] match_appearances table not readable:",
      error.message,
      "— run supabase/migrations/20260614190000_match_appearances.sql in Supabase SQL editor.",
    );
    return;
  }
  console.log("[apply] match_appearances table OK");
}

async function checkTeamRecordsTrigger(): Promise<void> {
  const { data, error } = await supabase.rpc("refresh_team_season_records", {
    p_season: 3,
  });
  if (error) {
    console.warn(
      "[apply] refresh_team_season_records RPC missing:",
      error.message,
      "— run supabase/migrations/20260614170000_team_season_records_auto_refresh.sql in Supabase SQL editor.",
    );
    return;
  }
  console.log("[apply] refresh_team_season_records(3) OK", data);
}

async function runSqlFileIfPg(relativePath: string): Promise<boolean> {
  const dbUrl =
    process.env.DATABASE_URL?.trim() ||
    process.env.SUPABASE_DB_URL?.trim() ||
    process.env.DIRECT_URL?.trim();
  if (!dbUrl) return false;

  let pg: typeof import("pg");
  try {
    pg = await import("pg");
  } catch {
    console.warn("[apply] pg not installed — cannot run SQL file", relativePath);
    return false;
  }

  const sql = fs.readFileSync(
    path.resolve(process.cwd(), relativePath),
    "utf8",
  );
  const client = new pg.default.Client({ connectionString: dbUrl });
  await client.connect();
  try {
    await client.query(sql);
    console.log("[apply] ran SQL:", relativePath);
    return true;
  } finally {
    await client.end();
  }
}

async function main(): Promise<void> {
  const ddlMigrations = [
    "supabase/migrations/20260614170000_team_season_records_auto_refresh.sql",
    "supabase/migrations/20260614190000_match_appearances.sql",
  ];

  let ranDdl = false;
  for (const file of ddlMigrations) {
    if (await runSqlFileIfPg(file)) ranDdl = true;
  }

  await applyArgentinaFft();
  await refreshTeamSeasonRecordsForSeason(supabase, 3);
  console.log("[apply] Season 3 team records refreshed");

  if (!ranDdl) {
    await checkMatchAppearances();
    await checkTeamRecordsTrigger();
  }

  console.log("[apply] done");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
