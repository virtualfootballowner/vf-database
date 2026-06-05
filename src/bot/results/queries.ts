import type { SupabaseClient } from "@supabase/supabase-js";

import { findPlayersByUsername } from "@/bot/stats-queries";
import type { ParsedPlayerStat } from "@/bot/results/parse";

export type MatchForResults = {
  id: string;
  roblox_match_id: string;
  season: number;
  competition: string | null;
  game_week_label: string | null;
  stage: string | null;
  status: string;
  home_team_id: string;
  away_team_id: string;
  home_name: string;
  away_name: string;
  home_slug: string | null;
  away_slug: string | null;
  home_score: number | null;
  away_score: number | null;
};

export type ResolvedPlayer = {
  username: string;
  count: number;
  playerId: string | null;
  robloxUserId: string | null;
  teamId: string | null;
  teamName: string | null;
  warnings: string[];
};

export type ApplyMatchResultInput = {
  match: MatchForResults;
  homeScore: number;
  awayScore: number;
  scorers: ParsedPlayerStat[];
  assists: ParsedPlayerStat[];
  motm: string | null;
  yellowCards: ParsedPlayerStat[];
  redCards: ParsedPlayerStat[];
  submittedByDiscordId: string;
};

export type ApplyMatchResultOutput = {
  resolvedScorers: ResolvedPlayer[];
  resolvedAssists: ResolvedPlayer[];
  resolvedMotm: ResolvedPlayer | null;
  resolvedYellows: ResolvedPlayer[];
  resolvedReds: ResolvedPlayer[];
  warnings: string[];
};

type DbEventType =
  | "goal"
  | "assist"
  | "yellow_card"
  | "red_card"
  | "motm";

export async function fetchMatchByRobloxId(
  supabase: SupabaseClient,
  robloxMatchId: string,
): Promise<MatchForResults | null> {
  const code = robloxMatchId.trim();
  if (!code) return null;

  const { data, error } = await supabase
    .from("matches")
    .select(
      "id, roblox_match_id, season, competition, game_week_label, stage, status, home_team_id, away_team_id, home_score, away_score",
    )
    .ilike("roblox_match_id", code)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;

  const row = data as {
    id: string;
    roblox_match_id: string | null;
    season: number;
    competition: string | null;
    game_week_label: string | null;
    stage: string | null;
    status: string;
    home_team_id: string;
    away_team_id: string;
    home_score: number | null;
    away_score: number | null;
  };

  const { data: teams, error: teamErr } = await supabase
    .from("teams")
    .select("id, name, slug")
    .in("id", [row.home_team_id, row.away_team_id]);
  if (teamErr) throw teamErr;

  const byId = new Map(
    (teams ?? []).map((t) => [
      (t as { id: string }).id,
      t as { id: string; name: string; slug: string | null },
    ]),
  );
  const home = byId.get(row.home_team_id);
  const away = byId.get(row.away_team_id);
  if (!home || !away) return null;

  return {
    id: row.id,
    roblox_match_id: row.roblox_match_id?.trim() || code,
    season: row.season,
    competition: row.competition,
    game_week_label: row.game_week_label,
    stage: row.stage,
    status: row.status,
    home_team_id: row.home_team_id,
    away_team_id: row.away_team_id,
    home_name: home.name,
    away_name: away.name,
    home_slug: home.slug?.trim() || null,
    away_slug: away.slug?.trim() || null,
    home_score: row.home_score,
    away_score: row.away_score,
  };
}

async function rosterSlugsForPlayer(
  supabase: SupabaseClient,
  playerId: string,
  season: number,
): Promise<Set<string>> {
  const { data, error } = await supabase
    .from("player_team_seasons")
    .select("team_slug")
    .eq("player_id", playerId)
    .eq("season", season);
  if (error) throw error;
  return new Set(
    (data ?? [])
      .map((r) => (r as { team_slug?: string | null }).team_slug?.trim())
      .filter((s): s is string => Boolean(s)),
  );
}

async function resolvePlayerStat(
  supabase: SupabaseClient,
  stat: ParsedPlayerStat,
  match: MatchForResults,
): Promise<ResolvedPlayer> {
  const warnings: string[] = [];
  const hits = await findPlayersByUsername(supabase, stat.username);

  if (hits.length === 0) {
    warnings.push(`No VF profile for **${stat.username}** — logged by name only.`);
    return {
      username: stat.username,
      count: stat.count,
      playerId: null,
      robloxUserId: null,
      teamId: null,
      teamName: null,
      warnings,
    };
  }

  if (hits.length > 1) {
    warnings.push(
      `Multiple profiles match **${stat.username}** — using \`${hits[0]!.roblox_username}\`.`,
    );
  }

  const player = hits[0]!;
  const slugs = await rosterSlugsForPlayer(supabase, player.id, match.season);

  let teamId: string | null = null;
  let teamName: string | null = null;
  if (match.home_slug && slugs.has(match.home_slug)) {
    teamId = match.home_team_id;
    teamName = match.home_name;
  } else if (match.away_slug && slugs.has(match.away_slug)) {
    teamId = match.away_team_id;
    teamName = match.away_name;
  } else if (slugs.size > 0) {
    warnings.push(
      `**${player.roblox_username}** is not on either squad for S${match.season} — team unset on event.`,
    );
  }

  return {
    username: player.roblox_username,
    count: stat.count,
    playerId: player.id,
    robloxUserId: player.roblox_user_id?.trim() || null,
    teamId,
    teamName,
    warnings,
  };
}

async function resolveMotm(
  supabase: SupabaseClient,
  username: string,
  match: MatchForResults,
): Promise<ResolvedPlayer> {
  return resolvePlayerStat(supabase, { username, count: 1 }, match);
}

function buildEventRow(
  matchId: string,
  eventType: DbEventType,
  resolved: ResolvedPlayer,
): {
  match_id: string;
  player_id: string | null;
  team_id: string | null;
  event_type: DbEventType;
  minute: null;
  details: Record<string, unknown>;
} {
  return {
    match_id: matchId,
    player_id: resolved.playerId,
    team_id: resolved.teamId,
    event_type: eventType,
    minute: null,
    details: {
      source: "discord_results_command",
      player: resolved.username,
      roblox_user_id: resolved.robloxUserId,
      count: resolved.count,
      notes: null,
    },
  };
}

async function refreshTeamSeasonRecordsForSeason(
  supabase: SupabaseClient,
  season: number,
): Promise<void> {
  const { data: teams, error: tErr } = await supabase
    .from("teams")
    .select("id, slug");
  if (tErr) throw tErr;

  const slugById = new Map<string, string>();
  for (const t of teams ?? []) {
    const s = (t as { slug?: string | null }).slug?.trim();
    if ((t as { id?: string }).id && s) {
      slugById.set((t as { id: string }).id, s);
    }
  }

  const { data: rows, error: mErr } = await supabase
    .from("matches")
    .select("home_team_id, away_team_id, home_score, away_score, status")
    .eq("season", season)
    .eq("status", "completed");
  if (mErr) throw mErr;

  type Tallies = { wins: number; losses: number; draws: number; played: number };
  const bySlug = new Map<string, Tallies>();

  function bump(slug: string, outcome: "w" | "l" | "d") {
    let t = bySlug.get(slug);
    if (!t) {
      t = { wins: 0, losses: 0, draws: 0, played: 0 };
      bySlug.set(slug, t);
    }
    t.played += 1;
    if (outcome === "w") t.wins += 1;
    else if (outcome === "l") t.losses += 1;
    else t.draws += 1;
  }

  for (const m of rows ?? []) {
    const homeSlug = slugById.get(m.home_team_id as string);
    const awaySlug = slugById.get(m.away_team_id as string);
    if (!homeSlug || !awaySlug) continue;

    const hs = (m.home_score as number | null) ?? 0;
    const as_ = (m.away_score as number | null) ?? 0;
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

export async function applyMatchResult(
  supabase: SupabaseClient,
  input: ApplyMatchResultInput,
): Promise<ApplyMatchResultOutput> {
  const { match } = input;
  if (match.status === "completed") {
    throw new Error(
      `Match **${match.roblox_match_id}** already has a result recorded.`,
    );
  }

  const resolvedScorers = await Promise.all(
    input.scorers.map((s) => resolvePlayerStat(supabase, s, match)),
  );
  const resolvedAssists = await Promise.all(
    input.assists.map((s) => resolvePlayerStat(supabase, s, match)),
  );
  const resolvedMotm = input.motm
    ? await resolveMotm(supabase, input.motm, match)
    : null;
  const resolvedYellows = await Promise.all(
    input.yellowCards.map((s) => resolvePlayerStat(supabase, s, match)),
  );
  const resolvedReds = await Promise.all(
    input.redCards.map((s) => resolvePlayerStat(supabase, s, match)),
  );

  const warnings = [
    ...resolvedScorers.flatMap((r) => r.warnings),
    ...resolvedAssists.flatMap((r) => r.warnings),
    ...(resolvedMotm?.warnings ?? []),
    ...resolvedYellows.flatMap((r) => r.warnings),
    ...resolvedReds.flatMap((r) => r.warnings),
  ];

  const now = new Date().toISOString();
  const eventRows = [
    ...resolvedScorers.map((r) => buildEventRow(match.id, "goal", r)),
    ...resolvedAssists.map((r) => buildEventRow(match.id, "assist", r)),
    ...(resolvedMotm ? [buildEventRow(match.id, "motm", resolvedMotm)] : []),
    ...resolvedYellows.map((r) => buildEventRow(match.id, "yellow_card", r)),
    ...resolvedReds.map((r) => buildEventRow(match.id, "red_card", r)),
  ];

  if (eventRows.length > 0) {
    const { error: evErr } = await supabase.from("match_events").insert(eventRows);
    if (evErr) throw evErr;
  }

  const { error: matchErr } = await supabase
    .from("matches")
    .update({
      home_score: input.homeScore,
      away_score: input.awayScore,
      status: "completed",
      ended_at: now,
    })
    .eq("id", match.id);
  if (matchErr) throw matchErr;

  const { error: rpcErr } = await supabase.rpc("refresh_player_goal_assist_totals");
  if (rpcErr) throw rpcErr;

  await refreshTeamSeasonRecordsForSeason(supabase, match.season);

  return {
    resolvedScorers,
    resolvedAssists,
    resolvedMotm,
    resolvedYellows,
    resolvedReds,
    warnings,
  };
}
