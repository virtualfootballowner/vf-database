import type { SupabaseClient } from "@supabase/supabase-js";

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
  fft: string | null;
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

export type ApplyMatchResultOutput = {
  resolvedScorers: ResolvedPlayer[];
  resolvedAssists: ResolvedPlayer[];
  resolvedMotm: ResolvedPlayer | null;
  resolvedYellows: ResolvedPlayer[];
  resolvedReds: ResolvedPlayer[];
  warnings: string[];
};

export async function fetchMatchByRobloxId(
  supabase: SupabaseClient,
  robloxMatchId: string,
): Promise<MatchForResults | null> {
  const code = robloxMatchId.trim();
  if (!code) return null;

  const { data, error } = await supabase
    .from("matches")
    .select(
      "id, roblox_match_id, season, competition, game_week_label, stage, status, home_team_id, away_team_id, home_score, away_score, fft",
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
    fft: string | null;
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
    fft: row.fft,
  };
}

export function formatPlayerStatLines(
  stats: { username: string; count: number }[],
): string {
  if (stats.length === 0) return "_None_";
  return stats
    .map((s) => (s.count > 1 ? `**${s.username}** ×${s.count}` : `**${s.username}**`))
    .join("\n");
}
