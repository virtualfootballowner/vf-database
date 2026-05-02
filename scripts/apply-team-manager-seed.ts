/**
 * Applies `TEAM_SEASON_MANAGER_SEED` to `team_season_managers`.
 *
 * Usage:
 *   tsx scripts/apply-team-manager-seed.ts                 # upsert only seeded keys
 *   tsx scripts/apply-team-manager-seed.ts --ensure-rows   # insert missing (slug, season) from teams-data without changing names
 *
 * Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import path from "node:path";

import { teams } from "../src/app/teams/teams-data";
import { TEAM_SEASON_MANAGER_SEED } from "../src/lib/team-season-manager-seed";

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

async function ensureCatalogRows(): Promise<void> {
  const rows: { team_slug: string; season: number; manager_display_name: null }[] =
    [];
  for (const t of teams) {
    for (const s of t.seasons) {
      rows.push({ team_slug: t.slug, season: s, manager_display_name: null });
    }
  }
  const chunk = 80;
  for (let i = 0; i < rows.length; i += chunk) {
    const part = rows.slice(i, i + chunk);
    const { error } = await supabase.from("team_season_managers").upsert(part, {
      onConflict: "team_slug,season",
      ignoreDuplicates: true,
    });
    if (error) throw error;
  }
  console.log(`ensure-rows: touched ${rows.length} catalog pairs (missing inserts only).`);
}

async function applySeed(): Promise<void> {
  const payloads: {
    team_slug: string;
    season: number;
    manager_display_name: string | null;
  }[] = [];

  for (const [slug, bySeason] of Object.entries(TEAM_SEASON_MANAGER_SEED)) {
    for (const [sk, name] of Object.entries(bySeason)) {
      const season = Number(sk);
      if (season !== 1 && season !== 2 && season !== 3) continue;
      payloads.push({
        team_slug: slug,
        season,
        manager_display_name: name,
      });
    }
  }

  if (payloads.length === 0) {
    console.log("seed: TEAM_SEASON_MANAGER_SEED is empty — nothing to upsert.");
    return;
  }

  const { error } = await supabase.from("team_season_managers").upsert(payloads, {
    onConflict: "team_slug,season",
  });
  if (error) throw error;
  console.log(`seed: upserted ${payloads.length} manager name(s).`);
}

async function main(): Promise<void> {
  const ensure = process.argv.includes("--ensure-rows");
  if (ensure) await ensureCatalogRows();
  await applySeed();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
