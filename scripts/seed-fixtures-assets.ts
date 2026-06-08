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
  buildS3WorldCupFixtureRows,
  S3_WORLD_CUP_STRUCTURE,
} from "../src/lib/s3-world-cup-fixtures";
import { S3_WORLD_CUP_GROUP_FIXTURES } from "../src/lib/s3-world-cup-group-schedule";
import { S3_WORLD_CUP_GROUPS } from "../src/lib/s3-world-cup-groups";
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
  const s1s2 = buildS1S2FixtureDbSeedRows(matches);
  const s3 = buildS3WorldCupFixtureRows();
  const all = [...s1s2, ...s3];

  for (const batch of chunk(all, 80)) {
    const { error } = await supabase.from("fixtures").upsert(batch, {
      onConflict: "season,competition,fixture_code",
    });
    if (error) throw error;
  }

  console.log(`Fixtures: ${s1s2.length} S1/S2 + ${s3.length} S3 (World Cup 24) = ${all.length}.`);
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
        name: "Season 3 · World Cup (6×4)",
        type: "world_cup",
        format: "groups_knockout",
        status: "upcoming",
        start_date: "2026-06-05",
        end_date: "2026-07-17",
        season: 3,
        competition: "World Cup",
        structure_kind: "s3_world_cup_24",
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
        name: "Season 3 · World Cup (6×4)",
        structure_kind: "s3_world_cup_24",
        structure_config: S3_WORLD_CUP_STRUCTURE as unknown as Record<string, unknown>,
        start_date: "2026-06-05",
        end_date: "2026-07-17",
      })
      .eq("id", s3Existing.data.id);
    if (upd.error) throw upd.error;
    console.log("Tournaments: updated Season 3 World Cup structure.");
  }

  console.log("Tournament structures: S1 EuroLeague, S2 leagues, S3 World Cup.");
}

async function ensureS3WorldCupTeams(): Promise<void> {
  const slugsNeeded = new Set<string>();
  for (const group of Object.values(S3_WORLD_CUP_GROUPS)) {
    for (const slug of group) slugsNeeded.add(slug);
  }

  const rows = catalogTeams
    .filter((t) => t.slug && slugsNeeded.has(t.slug))
    .map((t) => ({
      name: t.name,
      abbreviation: (t.short || t.name.slice(0, 3)).slice(0, 8).toUpperCase(),
      slug: t.slug,
      logo_url: t.logo?.trim() || null,
      form_label: t.form?.trim() || null,
      seasons: [...t.seasons],
    }));

  const missing = [...slugsNeeded].filter(
    (slug) => !rows.some((r) => r.slug === slug),
  );
  if (missing.length > 0) {
    throw new Error(`Catalog missing S3 World Cup teams: ${missing.join(", ")}`);
  }

  const { data: existing, error: exErr } = await supabase
    .from("teams")
    .select("slug")
    .in("slug", [...slugsNeeded]);
  if (exErr) throw exErr;

  const have = new Set((existing ?? []).map((r) => r.slug));
  const toInsert = rows.filter((r) => !have.has(r.slug));

  if (toInsert.length > 0) {
    const { error } = await supabase.from("teams").insert(toInsert);
    if (error) throw error;
  }

  console.log(
    `Teams: ensured ${rows.length} S3 World Cup nations (${toInsert.length} inserted).`,
  );
}

async function upsertS3ScheduledGroupMatches(): Promise<void> {
  await ensureS3WorldCupTeams();
  const { data: tourney, error: tErr } = await supabase
    .from("tournaments")
    .select("id")
    .eq("season", 3)
    .eq("competition", "World Cup")
    .maybeSingle();
  if (tErr) throw tErr;
  if (!tourney?.id) {
    console.warn("S3 World Cup tournament row missing — skip scheduled matches.");
    return;
  }

  const { data: teamRows, error: teamErr } = await supabase
    .from("teams")
    .select("id, slug, name");
  if (teamErr) throw teamErr;

  const teamIdBySlug = new Map<string, string>();
  const teamIdByName = new Map<string, string>();
  for (const row of teamRows ?? []) {
    if (row.slug) teamIdBySlug.set(row.slug, row.id);
    if (row.name) teamIdByName.set(row.name.trim().toLowerCase(), row.id);
  }

  function teamIdForFixture(homeSlug: string, homeName: string): string {
    const bySlug = teamIdBySlug.get(homeSlug);
    if (bySlug) return bySlug;
    const byName = teamIdByName.get(homeName.trim().toLowerCase());
    if (byName) return byName;
    throw new Error(`Missing team id for slug=${homeSlug} name=${homeName}`);
  }

  const codes = S3_WORLD_CUP_GROUP_FIXTURES.map((f) => f.fixtureCode);
  const { error: delErr } = await supabase
    .from("matches")
    .delete()
    .in("roblox_match_id", codes);
  if (delErr) throw delErr;

  const rows = S3_WORLD_CUP_GROUP_FIXTURES.map((fx) => {
    const homeId = teamIdForFixture(fx.homeSlug, fx.homeTeamName);
    const awayId = teamIdForFixture(fx.awaySlug, fx.awayTeamName);
    return {
      tournament_id: tourney.id,
      home_team_id: homeId,
      away_team_id: awayId,
      home_score: 0,
      away_score: 0,
      stage: "Group",
      match_week: fx.matchday,
      status: "scheduled",
      scheduled_at: fx.scheduledAt,
      ended_at: null,
      roblox_match_id: fx.fixtureCode,
      referee: null,
      season: 3,
      competition: "World Cup",
      game_week_label: fx.matchdayLabel,
      fft: "No",
      match_notes: `Stadium: ${fx.stadium}`,
    };
  });

  for (const batch of chunk(rows, 30)) {
    const { error } = await supabase.from("matches").insert(batch);
    if (error) throw error;
  }

  console.log(`Scheduled matches: ${rows.length} S3 World Cup group fixtures.`);
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
  await upsertS3ScheduledGroupMatches();
  await linkFixtures();
  console.log("seed-fixtures-assets done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
