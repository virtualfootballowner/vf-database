/**
 * Upserts `assets`, `fixtures`, and tournament structure metadata.
 * Run after `db:import:website` (or chained) so `matches` exist for link.
 *
 * Prereq: `.env.local` with SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
 */
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import path from "node:path";

import {
  buildS1S2FixtureDbSeedRows,
  FIXTURE_SCHEDULE_RAW,
} from "../src/app/stats/fixtures-data";
import { matches } from "../src/app/stats/matches-data";
import {
  buildS3WorldCup16FixtureRows,
  S3_WORLD_CUP_STRUCTURE,
} from "../src/lib/s3-world-cup-fixtures";
import { teams as catalogTeams } from "../src/app/teams/teams-data";

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

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function distinctCompetitionsForSeason(season: number): string[] {
  const set = new Set<string>();
  for (const row of FIXTURE_SCHEDULE_RAW) {
    if (row[0] === season) set.add(row[1]);
  }
  return [...set];
}

async function upsertAssets(): Promise<void> {
  const siteRows = [
    {
      scope: "site" as const,
      ref_slug: "vf-logo",
      kind: "logo" as const,
      title: "Virtual Football League",
      public_url: "/vf logo.png",
      metadata: {},
    },
  ];

  const { error: siteErr } = await supabase.from("assets").upsert(siteRows, {
    onConflict: "scope,ref_slug,kind",
  });
  if (siteErr) throw siteErr;

  const teamRows = catalogTeams
    .filter((t) => t.logo && t.logo.trim() !== "")
    .map((t) => ({
      scope: "team" as const,
      ref_slug: t.slug,
      kind: "logo" as const,
      title: t.name,
      public_url: t.logo!.trim(),
      metadata: { short: t.short, seasons: t.seasons },
    }));

  for (const batch of chunk(teamRows, 40)) {
    const { error } = await supabase.from("assets").upsert(batch, {
      onConflict: "scope,ref_slug,kind",
    });
    if (error) throw error;
  }

  console.log(`Assets: site + ${teamRows.length} team logos.`);
}

async function upsertFixtures(): Promise<void> {
  const { error: delS3 } = await supabase
    .from("fixtures")
    .delete()
    .eq("season", 3)
    .eq("competition", "World Cup");
  if (delS3) throw delS3;

  const s1s2 = buildS1S2FixtureDbSeedRows(matches);
  const s3 = buildS3WorldCup16FixtureRows();
  const all = [...s1s2, ...s3];

  for (const batch of chunk(all, 80)) {
    const { error } = await supabase.from("fixtures").upsert(batch, {
      onConflict: "season,competition,fixture_code",
    });
    if (error) throw error;
  }

  console.log(`Fixtures: ${s1s2.length} S1/S2 + ${s3.length} S3 (World Cup 16) = ${all.length}.`);
}

async function patchTournamentStructures(): Promise<void> {
  const s1 = await supabase
    .from("tournaments")
    .update({
      structure_kind: "s1_euroleague_round_robin_knockout",
      structure_config: {
        format: "group_round_robin_plus_knockout",
        group_teams: 8,
        knockout_stages: ["Quarter-Final", "Semi-Final", "Final"],
      },
    })
    .eq("season", 1)
    .eq("competition", "EuroLeague");
  if (s1.error) throw s1.error;

  for (const comp of distinctCompetitionsForSeason(2)) {
    const s2 = await supabase
      .from("tournaments")
      .update({
        structure_kind: "s2_multi_league",
        structure_config: {
          format: "parallel_domestic_leagues",
          league: comp,
          leagues_in_season: distinctCompetitionsForSeason(2),
        },
      })
      .eq("season", 2)
      .eq("competition", comp);
    if (s2.error) throw s2.error;
  }

  const s3Existing = await supabase
    .from("tournaments")
    .select("id")
    .eq("season", 3)
    .eq("competition", "World Cup")
    .maybeSingle();

  if (s3Existing.error) throw s3Existing.error;

  if (!s3Existing.data?.id) {
    const ins = await supabase
      .from("tournaments")
      .insert({
        name: "Season 3 · World Cup (16 teams)",
        type: "world_cup",
        format: "groups_knockout",
        status: "upcoming",
        start_date: "2026-06-01",
        end_date: "2026-07-15",
        season: 3,
        competition: "World Cup",
        structure_kind: "s3_world_cup_16",
        structure_config: S3_WORLD_CUP_STRUCTURE as unknown as Record<string, unknown>,
      })
      .select("id")
      .single();
    if (ins.error) throw ins.error;
    console.log("Tournaments: inserted Season 3 World Cup shell.");
  } else {
    const upd = await supabase
      .from("tournaments")
      .update({
        name: "Season 3 · World Cup (16 teams)",
        structure_kind: "s3_world_cup_16",
        structure_config: S3_WORLD_CUP_STRUCTURE as unknown as Record<string, unknown>,
      })
      .eq("id", s3Existing.data.id);
    if (upd.error) throw upd.error;
    console.log("Tournaments: updated Season 3 World Cup structure.");
  }

  console.log("Tournament structures: S1 EuroLeague, S2 leagues, S3 World Cup.");
}

async function linkFixtures(): Promise<void> {
  const { data, error } = await supabase.rpc("link_fixtures_to_matches");
  if (error) throw error;
  console.log(`Linked fixtures → matches (${data ?? 0} rows updated).`);
}

async function main(): Promise<void> {
  await upsertAssets();
  await upsertFixtures();
  await patchTournamentStructures();
  await linkFixtures();
  console.log("seed-fixtures-assets done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
