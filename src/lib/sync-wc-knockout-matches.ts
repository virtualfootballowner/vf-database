import type { SupabaseClient } from "@supabase/supabase-js";

import { buildS3WorldCupFixtureRows } from "@/lib/s3-world-cup-fixtures";
import { S3_WORLD_CUP_KNOCKOUT_FIXTURES } from "@/lib/s3-world-cup-knockout-schedule";

export type SyncWcKnockoutMatchesResult = {
  fixtureUpserts: number;
  matchUpserts: number;
  skippedCompleted: number;
};

/**
 * Upsert knockout fixtures + scheduled matches for any draw with resolved teams.
 * Keeps the fixtures page and matches archive aligned with repo schedule data.
 */
export async function syncWcKnockoutMatches(
  supabase: SupabaseClient,
): Promise<SyncWcKnockoutMatchesResult> {
  const resolved = S3_WORLD_CUP_KNOCKOUT_FIXTURES.filter(
    (fx) => fx.homeSlug && fx.awaySlug,
  );
  if (resolved.length === 0) {
    return { fixtureUpserts: 0, matchUpserts: 0, skippedCompleted: 0 };
  }

  const resolvedCodes = new Set(resolved.map((fx) => fx.fixtureCode));

  const { data: tourney, error: tErr } = await supabase
    .from("tournaments")
    .select("id")
    .eq("season", 3)
    .eq("competition", "World Cup")
    .maybeSingle();
  if (tErr) throw tErr;
  if (!tourney?.id) throw new Error("Season 3 World Cup tournament row missing");

  const { data: teamRows, error: teamErr } = await supabase
    .from("teams")
    .select("id, slug");
  if (teamErr) throw teamErr;

  const teamIdBySlug = new Map<string, string>();
  for (const row of teamRows ?? []) {
    if (row.slug) teamIdBySlug.set(row.slug, row.id);
  }

  const fixtureRows = buildS3WorldCupFixtureRows().filter((r) =>
    resolvedCodes.has(r.fixture_code),
  );
  const { error: fxErr } = await supabase.from("fixtures").upsert(fixtureRows, {
    onConflict: "season,competition,fixture_code",
  });
  if (fxErr) throw fxErr;

  let matchUpserts = 0;
  let skippedCompleted = 0;

  for (const fx of resolved) {
    const homeTeamId = teamIdBySlug.get(fx.homeSlug!);
    const awayTeamId = teamIdBySlug.get(fx.awaySlug!);
    if (!homeTeamId || !awayTeamId) {
      throw new Error(
        `Missing team id for ${fx.fixtureCode}: ${fx.homeSlug} / ${fx.awaySlug}`,
      );
    }

    const payload = {
      tournament_id: tourney.id,
      home_team_id: homeTeamId,
      away_team_id: awayTeamId,
      stage: fx.stage,
      status: "scheduled",
      scheduled_at: fx.scheduledAt,
      season: 3,
      competition: "World Cup",
      game_week_label: fx.stage,
      match_notes: `Stadium: ${fx.stadium}`,
    };

    const { data: existing, error: exErr } = await supabase
      .from("matches")
      .select("id, status")
      .eq("roblox_match_id", fx.fixtureCode)
      .maybeSingle();
    if (exErr) throw exErr;

    if (existing?.id) {
      if (existing.status !== "scheduled") {
        skippedCompleted += 1;
        continue;
      }
      const { error } = await supabase
        .from("matches")
        .update(payload)
        .eq("id", existing.id);
      if (error) throw error;
    } else {
      const { error } = await supabase.from("matches").insert({
        ...payload,
        home_score: 0,
        away_score: 0,
        ended_at: null,
        roblox_match_id: fx.fixtureCode,
        referee: null,
        match_week: null,
        fft: "No",
      });
      if (error) throw error;
    }

    matchUpserts += 1;
  }

  const { error: linkErr } = await supabase.rpc("link_fixtures_to_matches");
  if (linkErr) throw linkErr;

  return {
    fixtureUpserts: fixtureRows.length,
    matchUpserts,
    skippedCompleted,
  };
}
