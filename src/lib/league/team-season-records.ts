import type { SupabaseClient } from "@supabase/supabase-js";

type Tallies = { wins: number; losses: number; draws: number; played: number };

function emptyTally(): Tallies {
  return { wins: 0, losses: 0, draws: 0, played: 0 };
}

/**
 * Recompute `team_season_records` from all completed `matches` for one season.
 * Safe to call after any result change (Roblox finalize, manual patch, FFT, etc.).
 */
export async function refreshTeamSeasonRecordsForSeason(
  supabase: SupabaseClient,
  season: number,
): Promise<void> {
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
    .select("home_team_id, away_team_id, home_score, away_score, status")
    .eq("season", season)
    .eq("status", "completed");
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
    season,
    wins: t.wins,
    losses: t.losses,
    draws: t.draws,
    matches_played: t.played,
  }));

  if (upserts.length === 0) return;

  const { error: uErr } = await supabase
    .from("team_season_records")
    .upsert(upserts, { onConflict: "team_slug,season" });
  if (uErr) throw uErr;
}

/** Refresh standings for the season of a fixture row (by match id or roblox code). */
export async function refreshTeamSeasonRecordsForMatch(
  supabase: SupabaseClient,
  matchId: string,
): Promise<void> {
  const { data, error } = await supabase
    .from("matches")
    .select("season")
    .eq("id", matchId)
    .maybeSingle();
  if (error) throw error;
  const season = typeof data?.season === "number" ? data.season : null;
  if (season == null) return;
  await refreshTeamSeasonRecordsForSeason(supabase, season);
}

/** Best-effort refresh — logs and never throws (for Discord post / backfill hooks). */
export async function refreshTeamSeasonRecordsForMatchBestEffort(
  supabase: SupabaseClient,
  matchId: string,
  logPrefix = "[team-records]",
): Promise<void> {
  try {
    await refreshTeamSeasonRecordsForMatch(supabase, matchId);
  } catch (e) {
    console.error(`${logPrefix} refresh failed for match ${matchId}:`, e);
  }
}
