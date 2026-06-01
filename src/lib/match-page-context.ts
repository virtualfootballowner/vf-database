import "server-only";

import type { MatchRecord } from "@/app/stats/matches-data";
import type { Team } from "@/app/teams/teams-data";
import { fillManagerNamesFromSeed } from "@/lib/team-season-manager-fallback";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { getMatchTeamResolver, getSiteStatsBundle } from "@/lib/site-db";

export type MatchOfficials = {
  mainRef: string | null;
  linesman: string | null;
};

export type TeamSideContext = {
  team: Team;
  name: string;
  slug: string | null;
  manager: string | null;
};

export type MatchPageContext = {
  match: MatchRecord;
  home: TeamSideContext;
  away: TeamSideContext;
  officials: MatchOfficials;
};

function refereeDisplayName(
  robloxUsername: string | null | undefined,
  discordUsername: string | null | undefined,
): string | null {
  const rbx = robloxUsername?.trim();
  if (rbx) return rbx;
  const disc = discordUsername?.trim();
  if (disc) return disc;
  return null;
}

async function managerForTeamSeason(
  slug: string | null,
  season: number,
): Promise<string | null> {
  if (!slug?.trim()) return null;

  const fromDb = new Map<number, string | null>();
  try {
    const supabase = createSupabaseServerClient();
    const { data, error } = await supabase
      .from("team_season_managers")
      .select("manager_display_name")
      .eq("team_slug", slug)
      .eq("season", season)
      .maybeSingle();
    if (!error && data) {
      const raw = data.manager_display_name;
      fromDb.set(
        season,
        raw == null || String(raw).trim() === "" ? null : String(raw).trim(),
      );
    }
  } catch {
    /* use seed fallback */
  }

  return fillManagerNamesFromSeed(slug, [season], fromDb).get(season) ?? null;
}

async function fetchManagersForSlugs(
  season: number,
  homeSlug: string | null,
  awaySlug: string | null,
): Promise<{ home: string | null; away: string | null }> {
  const [home, away] = await Promise.all([
    managerForTeamSeason(homeSlug, season),
    managerForTeamSeason(awaySlug, season),
  ]);
  return { home, away };
}

async function fetchOfficialsForMatch(
  match: MatchRecord,
  matchUuid: string | null,
): Promise<MatchOfficials> {
  const mainFromMatch = match.referee?.trim();
  const mainDefault =
    mainFromMatch && mainFromMatch !== "—" ? mainFromMatch : null;

  if (!matchUuid) {
    return { mainRef: mainDefault, linesman: null };
  }

  try {
    const supabase = createSupabaseServerClient();
    const { data, error } = await supabase
      .from("referee_assignments")
      .select(
        "main_referee_id, linesman_referee_id, main_claimed_by_discord_id, linesman_claimed_by_discord_id, referee_id",
      )
      .eq("match_id", matchUuid)
      .in("status", ["open", "claimed"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error || !data) {
      return { mainRef: mainDefault, linesman: null };
    }

    const refIds = [
      data.main_referee_id,
      data.linesman_referee_id,
      data.referee_id,
    ].filter((id): id is string => Boolean(id));

    const refereeById = new Map<
      string,
      { roblox_username: string | null; discord_username: string | null }
    >();

    if (refIds.length > 0) {
      const { data: refs } = await supabase
        .from("referees")
        .select("id, roblox_username, discord_username")
        .in("id", refIds);
      for (const r of refs ?? []) {
        refereeById.set(r.id as string, {
          roblox_username: r.roblox_username as string | null,
          discord_username: r.discord_username as string | null,
        });
      }
    }

    const mainRef =
      refereeDisplayName(
        data.main_referee_id
          ? refereeById.get(data.main_referee_id)?.roblox_username
          : null,
        data.main_referee_id
          ? refereeById.get(data.main_referee_id)?.discord_username
          : null,
      ) ??
      (data.referee_id
        ? refereeDisplayName(
            refereeById.get(data.referee_id)?.roblox_username,
            refereeById.get(data.referee_id)?.discord_username,
          )
        : null) ??
      mainDefault;

    const linesman = data.linesman_referee_id
      ? refereeDisplayName(
          refereeById.get(data.linesman_referee_id)?.roblox_username,
          refereeById.get(data.linesman_referee_id)?.discord_username,
        )
      : null;

    return { mainRef: mainRef ?? mainDefault, linesman };
  } catch {
    return { mainRef: mainDefault, linesman: null };
  }
}

async function fetchMatchUuid(robloxMatchId: string): Promise<string | null> {
  try {
    const supabase = createSupabaseServerClient();
    const { data, error } = await supabase
      .from("matches")
      .select("id")
      .eq("roblox_match_id", robloxMatchId)
      .maybeSingle();
    if (error || !data) return null;
    return data.id as string;
  } catch {
    return null;
  }
}

export function matchDetailPath(robloxMatchId: string | null | undefined): string | null {
  const id = robloxMatchId?.trim();
  if (!id) return null;
  return `/stats/matches/${encodeURIComponent(id)}`;
}

/** World Cup fixture codes are stored as `roblox_match_id` when synced to the DB. */
export function fixtureCodeMatchHref(
  fixtureCode: string,
  matchesByRobloxId: Map<string, MatchRecord>,
): string | null {
  const code = fixtureCode.trim();
  if (!code || !matchesByRobloxId.has(code)) return null;
  return matchDetailPath(code);
}

export async function loadMatchPageContext(
  robloxMatchId: string,
): Promise<MatchPageContext | null> {
  const bundle = await getSiteStatsBundle();
  const match = bundle.matchesByRobloxId.get(robloxMatchId) ?? null;
  if (!match) return null;

  const getTeam = getMatchTeamResolver(bundle.teams);
  const homeTeam = getTeam(match.homeSlug, match.homeTeam);
  const awayTeam = getTeam(match.awaySlug, match.awayTeam);

  const [managers, matchUuid] = await Promise.all([
    fetchManagersForSlugs(match.season, match.homeSlug, match.awaySlug),
    fetchMatchUuid(robloxMatchId),
  ]);

  const officials = await fetchOfficialsForMatch(match, matchUuid);

  return {
    match,
    home: {
      team: homeTeam,
      name: match.homeTeam,
      slug: match.homeSlug,
      manager: managers.home,
    },
    away: {
      team: awayTeam,
      name: match.awayTeam,
      slug: match.awaySlug,
      manager: managers.away,
    },
    officials,
  };
}
