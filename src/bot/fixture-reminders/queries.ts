import type { SupabaseClient } from "@supabase/supabase-js";

export type ReminderKind = "24h" | "1h";

export type ScheduledMatchReminderRow = {
  id: string;
  roblox_match_id: string | null;
  season: number | null;
  competition: string | null;
  game_week_label: string | null;
  scheduled_at: string;
  home_team_id: string;
  away_team_id: string;
  home_slug: string;
  home_name: string;
  away_slug: string;
  away_name: string;
};

export async function fetchScheduledMatchesWithin(
  supabase: SupabaseClient,
  lookaheadMs: number,
): Promise<ScheduledMatchReminderRow[]> {
  const now = new Date();
  const until = new Date(now.getTime() + lookaheadMs).toISOString();

  const { data: matches, error } = await supabase
    .from("matches")
    .select(
      "id, roblox_match_id, season, competition, game_week_label, scheduled_at, home_team_id, away_team_id",
    )
    .eq("status", "scheduled")
    .gt("scheduled_at", now.toISOString())
    .lte("scheduled_at", until)
    .order("scheduled_at", { ascending: true });

  if (error) throw error;
  if (!matches?.length) return [];

  const teamIds = new Set<string>();
  for (const m of matches) {
    const row = m as { home_team_id: string; away_team_id: string };
    teamIds.add(row.home_team_id);
    teamIds.add(row.away_team_id);
  }

  const { data: teams, error: teamErr } = await supabase
    .from("teams")
    .select("id, slug, name")
    .in("id", [...teamIds]);
  if (teamErr) throw teamErr;

  const byId = new Map(
    (teams ?? []).map((t) => [
      t.id as string,
      t as { id: string; slug: string; name: string },
    ]),
  );

  const out: ScheduledMatchReminderRow[] = [];
  for (const m of matches) {
    const row = m as {
      id: string;
      roblox_match_id: string | null;
      season: number | null;
      competition: string | null;
      game_week_label: string | null;
      scheduled_at: string;
      home_team_id: string;
      away_team_id: string;
    };
    const home = byId.get(row.home_team_id);
    const away = byId.get(row.away_team_id);
    if (!home || !away) continue;
    out.push({
      id: row.id,
      roblox_match_id: row.roblox_match_id,
      season: row.season,
      competition: row.competition,
      game_week_label: row.game_week_label,
      scheduled_at: row.scheduled_at,
      home_team_id: row.home_team_id,
      away_team_id: row.away_team_id,
      home_slug: home.slug,
      home_name: home.name,
      away_slug: away.slug,
      away_name: away.name,
    });
  }
  return out;
}

export async function fetchManagerDiscordIdsForSeason(
  supabase: SupabaseClient,
  season: number,
): Promise<Map<string, string>> {
  const { data, error } = await supabase
    .from("team_season_managers")
    .select("team_slug, manager_discord_id")
    .eq("season", season);

  if (error) {
    const code = (error as { code?: string }).code;
    if (code === "42703" || code === "PGRST204") return new Map();
    throw error;
  }

  const map = new Map<string, string>();
  for (const row of data ?? []) {
    const slug = (row as { team_slug?: string }).team_slug?.trim();
    const id = (row as { manager_discord_id?: string | null }).manager_discord_id?.trim();
    if (slug && id) map.set(slug, id);
  }
  return map;
}

export async function claimReminderSlot(
  supabase: SupabaseClient,
  input: {
    matchId: string;
    managerDiscordId: string;
    kind: ReminderKind;
  },
): Promise<boolean> {
  const { error } = await supabase.from("match_manager_fixture_reminders").insert({
    match_id: input.matchId,
    manager_discord_id: input.managerDiscordId,
    reminder_kind: input.kind,
  });

  if (error) {
    if ((error as { code?: string }).code === "23505") return false;
    throw error;
  }
  return true;
}

export async function releaseReminderSlot(
  supabase: SupabaseClient,
  input: {
    matchId: string;
    managerDiscordId: string;
    kind: ReminderKind;
  },
): Promise<void> {
  const { error } = await supabase
    .from("match_manager_fixture_reminders")
    .delete()
    .eq("match_id", input.matchId)
    .eq("manager_discord_id", input.managerDiscordId)
    .eq("reminder_kind", input.kind);
  if (error) throw error;
}
