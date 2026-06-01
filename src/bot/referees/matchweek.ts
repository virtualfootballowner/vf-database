import type { SupabaseClient } from "@supabase/supabase-js";

export type RefMatchweekMatch = {
  id: string;
  roblox_match_id: string | null;
  season: number | null;
  competition: string | null;
  stage: string | null;
  match_week: number | null;
  game_week_label: string | null;
  scheduled_at: string;
  home_team_id: string;
  away_team_id: string;
  match_notes: string | null;
  home_name: string;
  home_slug: string | null;
  away_name: string;
  away_slug: string | null;
};

export type RefMatchweekBundle = {
  label: string;
  competition: string;
  season: number;
  matches: RefMatchweekMatch[];
};

function matchweekKey(m: {
  season: number | null;
  competition: string | null;
  game_week_label: string | null;
  match_week: number | null;
  scheduled_at: string;
}): string {
  const gw = m.game_week_label?.trim();
  if (gw && gw !== "—") {
    return `${m.season ?? 0}|${m.competition ?? ""}|${gw}`;
  }
  if (m.match_week != null) {
    return `${m.season ?? 0}|${m.competition ?? ""}|mw:${m.match_week}`;
  }
  const day = m.scheduled_at?.slice(0, 10) ?? "unknown";
  return `${m.season ?? 0}|${m.competition ?? ""}|d:${day}`;
}

export async function fetchNextMatchweekBundle(
  supabase: SupabaseClient,
): Promise<RefMatchweekBundle | null> {
  const now = new Date().toISOString();
  const { data: matches, error } = await supabase
    .from("matches")
    .select(
      "id, roblox_match_id, season, competition, stage, match_week, game_week_label, scheduled_at, home_team_id, away_team_id, match_notes",
    )
    .eq("status", "scheduled")
    .gt("scheduled_at", now)
    .order("scheduled_at", { ascending: true });

  if (error) throw error;
  if (!matches?.length) return null;

  const first = matches[0] as RefMatchweekMatch;
  const key = matchweekKey(first);
  const bucket = (matches as RefMatchweekMatch[]).filter(
    (m) => matchweekKey(m) === key,
  );

  const teamIds = new Set<string>();
  for (const m of bucket) {
    teamIds.add(m.home_team_id);
    teamIds.add(m.away_team_id);
  }

  const { data: teams, error: teamErr } = await supabase
    .from("teams")
    .select("id, name, slug")
    .in("id", [...teamIds]);
  if (teamErr) throw teamErr;

  const byId = new Map(
    (teams ?? []).map((t) => [
      t.id as string,
      t as { id: string; name: string; slug: string | null },
    ]),
  );

  const enriched: RefMatchweekMatch[] = [];
  for (const raw of bucket) {
    const home = byId.get(raw.home_team_id);
    const away = byId.get(raw.away_team_id);
    if (!home || !away) continue;
    enriched.push({
      ...raw,
      home_name: home.name,
      home_slug: home.slug,
      away_name: away.name,
      away_slug: away.slug,
    });
  }

  if (enriched.length === 0) return null;

  const label =
    first.game_week_label?.trim() ||
    (first.match_week != null ? `Matchweek ${first.match_week}` : "Next matchday");

  return {
    label,
    competition: first.competition?.trim() || "—",
    season: first.season ?? 0,
    matches: enriched,
  };
}

/** Close prior assignment posts so staff can run /ref-fixtures again for the same matchday. */
export async function cancelPreviousAssignmentsForMatches(
  supabase: SupabaseClient,
  guildId: string,
  matchIds: string[],
): Promise<number> {
  if (matchIds.length === 0) return 0;
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("referee_assignments")
    .update({ status: "cancelled", updated_at: now })
    .eq("guild_id", guildId)
    .in("match_id", matchIds)
    .in("status", ["open", "claimed"])
    .select("id");
  if (error) throw error;
  return data?.length ?? 0;
}
