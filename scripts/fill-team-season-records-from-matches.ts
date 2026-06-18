/**
 * Recomputes `team_season_records` from Supabase `matches` (home/away scores) per season.
 * Site displays W–D–L; DB columns remain wins, losses, draws.
 *
 * Usage:
 *   tsx scripts/fill-team-season-records-from-matches.ts           # all seasons present in `matches`
 *   tsx scripts/fill-team-season-records-from-matches.ts 1 2       # only these seasons
 *
 * Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import path from "node:path";

import { refreshTeamSeasonRecordsForSeason } from "../src/lib/league/team-season-records";

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

async function main() {
  const argv = process.argv
    .slice(2)
    .map((a) => Number.parseInt(a, 10))
    .filter((n) => Number.isFinite(n));

  let seasons: number[];
  if (argv.length > 0) {
    seasons = [...new Set(argv)].sort((a, b) => a - b);
  } else {
    const { data, error } = await supabase.from("matches").select("season");
    if (error) throw error;
    const set = new Set<number>();
    for (const r of data ?? []) {
      if (r.season != null && Number.isFinite(Number(r.season))) {
        set.add(Number(r.season));
      }
    }
    seasons = [...set].sort((a, b) => a - b);
  }

  if (seasons.length === 0) {
    console.log("No seasons to process.");
    return;
  }

  console.log(`Filling team_season_records for seasons: ${seasons.join(", ")}`);
  for (const s of seasons) {
    await refreshTeamSeasonRecordsForSeason(supabase, s);
    console.log(`Season ${s}: refreshed`);
  }
  console.log("Done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
