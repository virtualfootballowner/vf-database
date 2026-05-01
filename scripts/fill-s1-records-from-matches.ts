/**
 * Recomputes `team_season_records` for Season 1 from Supabase `matches` (home/away scores).
 * Counts W / L / D from final scorelines (includes FFT games as scored).
 *
 * Prereq: matches with season=1, home_team_id, away_team_id, home_score, away_score
 * Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *
 * Run: npm run db:fill:s1-records
 */
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import path from "node:path";

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

const SEASON = 1 as const;

type Tallies = { wins: number; losses: number; draws: number; played: number };

function emptyTally(): Tallies {
  return { wins: 0, losses: 0, draws: 0, played: 0 };
}

async function main() {
  const { data: teams, error: tErr } = await supabase
    .from("teams")
    .select("id, slug");
  if (tErr) throw tErr;

  const slugById = new Map<string, string>();
  for (const t of teams ?? []) {
    const s = t.slug?.trim();
    if (t.id && s) slugById.set(t.id, s);
  }

  const { data: rows, error: mErr } = await supabase
    .from("matches")
    .select("home_team_id, away_team_id, home_score, away_score")
    .eq("season", SEASON);
  if (mErr) throw mErr;

  const bySlug = new Map<string, Tallies>();

  function bump(slug: string, outcome: "w" | "l" | "d") {
    let t = bySlug.get(slug);
    if (!t) {
      t = emptyTally();
      bySlug.set(slug, t);
    }
    t.played += 1;
    if (outcome === "w") t.wins += 1;
    else if (outcome === "l") t.losses += 1;
    else t.draws += 1;
  }

  for (const m of rows ?? []) {
    const homeSlug = slugById.get(m.home_team_id);
    const awaySlug = slugById.get(m.away_team_id);
    if (!homeSlug || !awaySlug) continue;

    const hs = m.home_score ?? 0;
    const as_ = m.away_score ?? 0;
    if (hs > as_) {
      bump(homeSlug, "w");
      bump(awaySlug, "l");
    } else if (as_ > hs) {
      bump(awaySlug, "w");
      bump(homeSlug, "l");
    } else {
      bump(homeSlug, "d");
      bump(awaySlug, "d");
    }
  }

  const upserts = [...bySlug.entries()].map(([team_slug, t]) => ({
    team_slug,
    season: SEASON,
    wins: t.wins,
    losses: t.losses,
    draws: t.draws,
    matches_played: t.played,
  }));

  console.log(`Season ${SEASON} records to upsert: ${upserts.length} teams`);
  for (const r of upserts.sort((a, b) => a.team_slug.localeCompare(b.team_slug))) {
    console.log(
      `  ${r.team_slug}: ${r.wins}-${r.losses}-${r.draws} (${r.matches_played} gp)`,
    );
  }

  if (upserts.length === 0) {
    console.log("No rows; check matches.season and team slugs.");
    return;
  }

  const { error: uErr } = await supabase.from("team_season_records").upsert(
    upserts,
    { onConflict: "team_slug,season" },
  );
  if (uErr) throw uErr;
  console.log("Done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
