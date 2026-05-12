import type { SupabaseClient } from "@supabase/supabase-js";

import { teams as catalogTeams } from "@/app/teams/teams-data";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { fillManagerNamesFromSeed } from "@/lib/team-season-manager-fallback";

/** Service-role client (normalized Supabase URL — matches `player-sync`). */
export function createBotSupabase(): SupabaseClient {
  return supabaseAdmin;
}

export type TeamRow = {
  name: string;
  slug: string | null;
  logo_url: string | null;
  abbreviation: string | null;
  /** Catalog seasons for this team (e.g. `[3]` for WC-only nations). */
  seasons?: number[] | null;
};

function normalizeSeasonsColumn(raw: unknown): number[] | null {
  if (!Array.isArray(raw)) return null;
  const nums = raw
    .map((x) => Number(x))
    .filter((n) => Number.isFinite(n)) as number[];
  return nums.length ? nums : null;
}

/** WC / Season‑3 national rows in DB use `seasons = {3}` only (no league seasons). */
export function isSeason3ExclusiveNationTeam(t: {
  seasons?: number[] | null;
}): boolean {
  const s = t.seasons;
  if (!s?.length) return false;
  return s.every((x) => x === 3);
}

export async function loadTeams(supabase: SupabaseClient): Promise<TeamRow[]> {
  const { data, error } = await supabase
    .from("teams")
    .select("name, slug, logo_url, abbreviation, seasons")
    .not("slug", "is", null)
    .order("name", { ascending: true })
    .limit(5000);

  if (error) throw error;
  const rows = (data ?? []).map((r) => ({
    ...(r as TeamRow),
    seasons: normalizeSeasonsColumn((r as { seasons?: unknown }).seasons),
  }));
  const fromDb = rows.filter((r) => Boolean(r.slug?.trim())) as TeamRow[];

  /** Same idea as site `getTeamsCatalog`: DB can lag behind repo nations (S3). */
  const bySlug = new Map<string, TeamRow>();
  for (const t of fromDb) {
    const s = t.slug!.trim();
    bySlug.set(s, { ...t, slug: s });
  }
  for (const t of catalogTeams) {
    const s = t.slug?.trim();
    if (!s) continue;
    const existing = bySlug.get(s);
    if (existing) {
      const noSeasons = !existing.seasons?.length;
      if (noSeasons && t.seasons?.length) {
        bySlug.set(s, { ...existing, seasons: [...t.seasons] });
      }
      continue;
    }
    bySlug.set(s, {
      name: t.name,
      slug: s,
      logo_url: t.logo?.trim() || null,
      abbreviation: t.short?.trim() || null,
      seasons: t.seasons?.length ? [...t.seasons] : null,
    });
  }

  return [...bySlug.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export type ResolvedTeam = {
  name: string;
  slug: string;
  logo_url: string | null;
  abbreviation: string | null;
};

/** Trim, Unicode‑normalize, strip zero‑width chars — same rules for user input and DB slugs. */
export function normalizeTeamInputForLookup(raw: string): string {
  return raw
    .normalize("NFKC")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .trim()
    .toLowerCase();
}

const SLUG_LOOKUP_ALIASES: Record<string, string> = {};

function mapResolvedRow(row: {
  name: string;
  slug: string | null;
  logo_url: string | null;
  abbreviation: string | null;
}): ResolvedTeam | null {
  const slug = row.slug?.trim() ?? "";
  if (!slug) return null;
  return {
    name: row.name,
    slug,
    logo_url: row.logo_url ?? null,
    abbreviation: row.abbreviation ?? null,
  };
}

export function resolveTeamFromList(
  teams: TeamRow[],
  raw: string,
): ResolvedTeam | null {
  const q = normalizeTeamInputForLookup(raw);
  if (!q) return null;

  const withSlug = teams
    .map((t) => ({
      name: t.name,
      slug: (t.slug ?? "").trim(),
      logo_url: t.logo_url ?? null,
      abbreviation: t.abbreviation ?? null,
    }))
    .filter((t) => t.slug.length > 0);

  const aliasSlug = SLUG_LOOKUP_ALIASES[q];
  const bySlug = withSlug.find((t) => {
    const s = normalizeTeamInputForLookup(t.slug);
    return s === q || (aliasSlug !== undefined && s === aliasSlug);
  });
  if (bySlug) return bySlug;

  const byName = withSlug.find(
    (t) => normalizeTeamInputForLookup(t.name) === q,
  );
  if (byName) return byName;

  const partial = withSlug.find(
    (t) =>
      normalizeTeamInputForLookup(t.name).includes(q) ||
      normalizeTeamInputForLookup(t.slug).includes(q),
  );
  return partial ?? null;
}

/**
 * Resolve team for slash options: in‑memory list first, then direct DB lookup.
 * Covers invisible Unicode, hyphen/spacing variants, and cached list drift.
 */
export async function resolveTeamForSlashCommand(
  supabase: SupabaseClient,
  cachedRows: TeamRow[],
  raw: string,
): Promise<ResolvedTeam | null> {
  const fromList = resolveTeamFromList(cachedRows, raw);
  if (fromList) return fromList;

  const base = normalizeTeamInputForLookup(raw);
  if (!base) return null;

  const alias = SLUG_LOOKUP_ALIASES[base];
  const candidates = [
    ...new Set(
      [base, alias, base.replace(/\s+/g, "-"), base.replace(/-+/g, "-")].filter(
        (s): s is string => typeof s === "string" && s.length > 0,
      ),
    ),
  ];

  const { data: rowsIn, error: errIn } = await supabase
    .from("teams")
    .select("name, slug, logo_url, abbreviation")
    .in("slug", candidates)
    .limit(1);

  if (errIn) throw errIn;
  const hitIn = mapResolvedRow(rowsIn?.[0] ?? {});
  if (hitIn) return hitIn;

  const safeIlike = base.replace(/[%_\\]/g, "");
  if (safeIlike.length > 0) {
    const { data: rowsLike, error: errLike } = await supabase
      .from("teams")
      .select("name, slug, logo_url, abbreviation")
      .ilike("slug", safeIlike)
      .limit(1);

    if (errLike) throw errLike;
    const hitLike = mapResolvedRow(rowsLike?.[0] ?? {});
    if (hitLike) return hitLike;
  }

  if (/^[a-z]{2,4}$/.test(base)) {
    const { data: rowsAbbr, error: errAbbr } = await supabase
      .from("teams")
      .select("name, slug, logo_url, abbreviation")
      .ilike("abbreviation", base)
      .limit(1);

    if (errAbbr) throw errAbbr;
    const hitAbbr = mapResolvedRow(rowsAbbr?.[0] ?? {});
    if (hitAbbr) return hitAbbr;
  }

  return null;
}

export function filterTeamsForAutocomplete(
  teams: TeamRow[],
  focused: string,
): { name: string; slug: string }[] {
  const q = normalizeTeamInputForLookup(focused);
  const enriched = teams
    .map((t) => ({
      name: t.name,
      slug: (t.slug ?? "").trim(),
      seasons: t.seasons ?? null,
    }))
    .filter((t) => t.slug.length > 0);

  const list = enriched.map(({ name, slug }) => ({ name, slug }));

  if (!q) {
    // Discord allows at most 25 choices. Alphabetical-only hides WC nations behind many clubs.
    const nationals = enriched
      .filter((t) => isSeason3ExclusiveNationTeam(t))
      .sort((a, b) => a.name.localeCompare(b.name));
    const clubs = enriched
      .filter((t) => !isSeason3ExclusiveNationTeam(t))
      .sort((a, b) => a.name.localeCompare(b.name));
    const maxNationHead = 12;
    const nHead = nationals.slice(0, maxNationHead);
    const cHead = clubs.slice(0, 25 - nHead.length);
    const out = [...nHead, ...cHead];
    if (out.length < 25) {
      const used = new Set(out.map((x) => x.slug));
      for (const t of [...nationals.slice(nHead.length), ...clubs.slice(cHead.length)]) {
        if (out.length >= 25) break;
        if (used.has(t.slug)) continue;
        used.add(t.slug);
        out.push(t);
      }
    }
    return out.slice(0, 25).map(({ name, slug }) => ({ name, slug }));
  }

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
  discord_banned_at: string | null;
  discord_ban_reason: string | null;
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
  euroleague_champion: "EuroLeague Champions",
  euroblox_cup_champion: "EuroBlox Cup Champions",
};

export async function fetchTeamSeasonManagerName(
  supabase: SupabaseClient,
  teamSlug: string,
  season: number,
): Promise<string | null> {
  const mergeSeed = (fromDb: Map<number, string | null>) =>
    fillManagerNamesFromSeed(teamSlug, [season], fromDb).get(season) ?? null;
  const empty = new Map<number, string | null>();

  try {
    const { data, error } = await supabase
      .from("team_season_managers")
      .select("manager_display_name")
      .eq("team_slug", teamSlug)
      .eq("season", season)
      .maybeSingle();

    // PGRST205: table not migrated / not in PostgREST schema cache yet
    if (error) {
      return mergeSeed(empty);
    }

    const fromDb = new Map<number, string | null>();
    if (data) {
      const raw = data.manager_display_name;
      const t =
        raw != null && String(raw).trim() !== ""
          ? String(raw).trim()
          : null;
      fromDb.set(season, t);
    }
    return mergeSeed(fromDb);
  } catch {
    return mergeSeed(empty);
  }
}

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

export type ResolveManagerTeamResult =
  | { ok: true; teamSlug: string }
  | {
      ok: false;
      reason: "no_player" | "no_username" | "not_manager" | "ambiguous";
    };

/** Resolve team slug from `team_season_managers` for the contractor’s linked Roblox name. */
export async function resolveManagerTeamSlugForSeason(
  supabase: SupabaseClient,
  contractorDiscordId: string,
  season: number,
): Promise<ResolveManagerTeamResult> {
  const profile = await findPlayerByDiscordId(supabase, contractorDiscordId);
  if (!profile) return { ok: false, reason: "no_player" };
  const name = profile.roblox_username?.trim();
  if (!name) return { ok: false, reason: "no_username" };

  const { data, error } = await supabase
    .from("team_season_managers")
    .select("team_slug")
    .eq("season", season)
    .ilike("manager_display_name", name);

  if (error) throw error;
  const rows = data ?? [];
  const slugs = [
    ...new Set(
      rows.map((r) => String((r as { team_slug: string }).team_slug)),
    ),
  ];
  if (slugs.length === 0) return { ok: false, reason: "not_manager" };
  if (slugs.length > 1) return { ok: false, reason: "ambiguous" };
  return { ok: true, teamSlug: slugs[0]! };
}

/** All `team_slug` values the player is on for this season (usually 0–1). */
export async function listPlayerRosterTeamsForSeason(
  supabase: SupabaseClient,
  playerId: string,
  season: number,
): Promise<string[]> {
  const { data, error } = await supabase
    .from("player_team_seasons")
    .select("team_slug")
    .eq("player_id", playerId)
    .eq("season", season);
  if (error) throw error;
  return [
    ...new Set(
      (data ?? []).map((r) => String((r as { team_slug: string }).team_slug)),
    ),
  ];
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
