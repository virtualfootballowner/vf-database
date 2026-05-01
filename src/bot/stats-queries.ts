import type { SupabaseClient } from "@supabase/supabase-js";

import { supabaseAdmin } from "@/lib/supabase-admin";

/** Service-role client (normalized Supabase URL — matches `player-sync`). */
export function createBotSupabase(): SupabaseClient {
  return supabaseAdmin;
}

export type TeamRow = { name: string; slug: string | null };

export async function loadTeams(supabase: SupabaseClient): Promise<TeamRow[]> {
  const { data, error } = await supabase
    .from("teams")
    .select("name, slug")
    .not("slug", "is", null)
    .order("name", { ascending: true });

  if (error) throw error;
  return (data ?? []).filter((r): r is TeamRow & { slug: string } =>
    Boolean(r.slug?.trim()),
  ) as TeamRow[];
}

export function resolveTeamFromList(
  teams: TeamRow[],
  raw: string,
): { name: string; slug: string } | null {
  const q = raw.trim().toLowerCase();
  if (!q) return null;

  const withSlug = teams
    .map((t) => ({
      name: t.name,
      slug: (t.slug ?? "").trim(),
    }))
    .filter((t) => t.slug.length > 0);

  const bySlug = withSlug.find((t) => t.slug.toLowerCase() === q);
  if (bySlug) return bySlug;

  const byName = withSlug.find((t) => t.name.trim().toLowerCase() === q);
  if (byName) return byName;

  const partial = withSlug.find(
    (t) =>
      t.name.toLowerCase().includes(q) || t.slug.toLowerCase().includes(q),
  );
  return partial ?? null;
}

export function filterTeamsForAutocomplete(
  teams: TeamRow[],
  focused: string,
): { name: string; slug: string }[] {
  const q = focused.trim().toLowerCase();
  const list = teams
    .map((t) => ({ name: t.name, slug: (t.slug ?? "").trim() }))
    .filter((t) => t.slug.length > 0);

  if (!q) return list.slice(0, 25);

  const scored = list
    .map((t) => {
      const ln = t.name.toLowerCase();
      const ls = t.slug.toLowerCase();
      let score = 999;
      if (ln === q || ls === q) score = 0;
      else if (ln.startsWith(q) || ls.startsWith(q)) score = 1;
      else if (ln.includes(q) || ls.includes(q)) score = 2;
      return { t, score };
    })
    .filter((x) => x.score < 999)
    .sort((a, b) => a.score - b.score || a.t.name.localeCompare(b.t.name));

  return scored.slice(0, 25).map((x) => x.t);
}

export type PlayerProfileRow = {
  id: string;
  roblox_username: string;
  roblox_user_id: string | null;
  discord_id: string | null;
  discord_username: string | null;
  position: string | null;
  goals_total: number | null;
  assists_total: number | null;
  avg_rating: number | null;
  appearances_total: number | null;
  trophies: unknown;
  accolades: unknown;
};

export async function findPlayersByUsername(
  supabase: SupabaseClient,
  username: string,
): Promise<PlayerProfileRow[]> {
  const term = username.trim();
  if (!term) return [];

  const { data, error } = await supabase
    .from("players")
    .select("*")
    .ilike("roblox_username", term);

  if (error) throw error;
  return (data ?? []) as PlayerProfileRow[];
}

export async function findPlayerByDiscordId(
  supabase: SupabaseClient,
  discordId: string,
): Promise<PlayerProfileRow | null> {
  const { data, error } = await supabase
    .from("players")
    .select("*")
    .eq("discord_id", discordId)
    .maybeSingle();

  if (error) throw error;
  return (data as PlayerProfileRow | null) ?? null;
}

export type CareerRow = {
  team_slug: string;
  season: number;
  games: number | null;
};

export async function fetchPlayerCareer(
  supabase: SupabaseClient,
  playerId: string,
  teamNameBySlug: Map<string, string>,
): Promise<string[]> {
  const { data, error } = await supabase
    .from("player_team_seasons")
    .select("team_slug, season, games")
    .eq("player_id", playerId)
    .order("season", { ascending: true });

  if (error) throw error;
  const rows = (data ?? []) as CareerRow[];
  return rows.map((r) => {
    const club = teamNameBySlug.get(r.team_slug) ?? r.team_slug;
    const g =
      r.games != null && r.games > 0
        ? ` · ${r.games} app${r.games === 1 ? "" : "s"}`
        : "";
    return `S${r.season} · ${club}${g}`;
  });
}

export async function buildTeamNameBySlug(
  supabase: SupabaseClient,
): Promise<Map<string, string>> {
  const teams = await loadTeams(supabase);
  const m = new Map<string, string>();
  for (const t of teams) {
    const s = t.slug?.trim();
    if (s) m.set(s, t.name);
  }
  return m;
}

export type SeasonRecordRow = {
  wins: number;
  losses: number;
  draws: number;
  matches_played: number;
};

export async function fetchTeamSeasonRecord(
  supabase: SupabaseClient,
  teamSlug: string,
  season: number,
): Promise<SeasonRecordRow | null> {
  const { data, error } = await supabase
    .from("team_season_records")
    .select("wins, losses, draws, matches_played")
    .eq("team_slug", teamSlug)
    .eq("season", season)
    .maybeSingle();

  if (error) throw error;
  return (data as SeasonRecordRow | null) ?? null;
}

const HONOR_LABELS: Record<string, string> = {
  euroleague_champion: "EuroLeague champion",
  euroblox_cup_champion: "EuroBlox Cup champion",
};

export async function fetchTeamSeasonHonors(
  supabase: SupabaseClient,
  teamSlug: string,
  season: number,
): Promise<string[]> {
  const { data, error } = await supabase
    .from("team_season_honors")
    .select("honor_kind")
    .eq("team_slug", teamSlug)
    .eq("season", season);

  if (error) throw error;
  return (data ?? []).map(
    (r: { honor_kind: string }) =>
      HONOR_LABELS[r.honor_kind] ?? r.honor_kind,
  );
}

export type SquadRow = {
  roblox_username: string;
  position: string | null;
  games: number | null;
};

export async function fetchSquadForSeason(
  supabase: SupabaseClient,
  teamSlug: string,
  season: number,
): Promise<SquadRow[]> {
  const { data: pts, error } = await supabase
    .from("player_team_seasons")
    .select("player_id, games")
    .eq("team_slug", teamSlug)
    .eq("season", season);

  if (error) throw error;
  const links = pts ?? [];
  if (links.length === 0) return [];

  const ids = [...new Set(links.map((r) => r.player_id))];
  const { data: players, error: pErr } = await supabase
    .from("players")
    .select("id, roblox_username, position")
    .in("id", ids);

  if (pErr) throw pErr;
  const byId = new Map(
    (players ?? []).map((p) => [
      p.id as string,
      {
        roblox_username: p.roblox_username as string,
        position: p.position as string | null,
      },
    ]),
  );

  const out: SquadRow[] = [];
  for (const row of links) {
    const p = byId.get(row.player_id as string);
    if (!p) continue;
    out.push({
      roblox_username: p.roblox_username,
      position: p.position,
      games: row.games as number | null,
    });
  }

  out.sort((a, b) =>
    a.roblox_username.toLowerCase().localeCompare(b.roblox_username.toLowerCase()),
  );
  return out;
}

type HonorJson = { title?: string; season?: number; team?: string; meta?: string };

export function formatHonorList(raw: unknown, maxLines: number): string {
  if (!Array.isArray(raw) || raw.length === 0) return "—";
  const lines = raw.slice(0, maxLines).map((item) => {
    const o = item as HonorJson;
    const bits: string[] = [];
    if (o.title) bits.push(String(o.title));
    if (o.season != null) bits.push(`S${o.season}`);
    if (o.team) bits.push(String(o.team));
    if (o.meta) bits.push(String(o.meta));
    return bits.length ? bits.join(" · ") : JSON.stringify(item);
  });
  const extra = raw.length > maxLines ? `\n_…+${raw.length - maxLines} more_` : "";
  return lines.join("\n") + extra;
}
