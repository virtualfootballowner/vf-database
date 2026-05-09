import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { SiteNav } from "@/components/site-nav";
import { TrophyHonorIcon } from "@/components/trophy-honor-icon";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getRobloxHeadshots, isVerifiedRobloxUserId } from "@/lib/roblox";
import { fillManagerNamesFromSeed } from "@/lib/team-season-manager-fallback";
import { getAllTeamSlugs, getTeamBySlugFromDb } from "@/lib/site-db";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { teamHasSeason } from "@/lib/team-seasons";

import { TeamCrest } from "../team-crest";

const HONOR_LABELS: Record<string, string> = {
  euroleague_champion: "EuroLeague Champions",
  euroblox_cup_champion: "EuroBlox Cup Champions",
};

type TeamPlayerRow = {
  id: string;
  roblox_username: string;
  roblox_user_id: string | null;
  position: string | null;
};

type TeamSeasonRecordRow = {
  wins: number;
  losses: number;
  draws: number;
  matches_played: number;
};

async function getTeamSeasonRecordsForSeasons(
  slug: string,
  seasons: number[],
): Promise<TeamSeasonRecordRow | null> {
  if (seasons.length === 0) return null;
  try {
    const supabase = createSupabaseServerClient();
    const { data, error } = await supabase
      .from("team_season_records")
      .select("wins, losses, draws, matches_played")
      .eq("team_slug", slug)
      .in("season", seasons);
    if (error || !data?.length) return null;
    let wins = 0;
    let losses = 0;
    let draws = 0;
    let matchesPlayed = 0;
    for (const row of data) {
      wins += Number(row.wins);
      losses += Number(row.losses);
      draws += Number(row.draws);
      matchesPlayed += Number(row.matches_played);
    }
    return { wins, losses, draws, matches_played: matchesPlayed };
  } catch {
    return null;
  }
}

function formatSeasonRecord(row: TeamSeasonRecordRow | null): string {
  if (!row || row.matches_played === 0) return "—";
  return `${row.wins}–${row.draws}–${row.losses}`;
}

type TeamHonorRow = { honorKind: string; label: string };

async function getTeamSeasonHonorsForSeasons(
  slug: string,
  seasons: number[],
): Promise<TeamHonorRow[]> {
  if (seasons.length === 0) return [];
  try {
    const supabase = createSupabaseServerClient();
    const { data, error } = await supabase
      .from("team_season_honors")
      .select("honor_kind")
      .eq("team_slug", slug)
      .in("season", seasons)
      .order("honor_kind", { ascending: true });
    if (error || !data?.length) return [];
    const kinds = [...new Set(data.map((r) => r.honor_kind))];
    kinds.sort();
    return kinds.map((k) => ({
      honorKind: k,
      label: HONOR_LABELS[k] ?? k,
    }));
  } catch {
    return [];
  }
}

async function getTeamSeasonManagersBySeason(
  slug: string,
  seasons: number[],
): Promise<Map<number, string | null>> {
  const fromDb = new Map<number, string | null>();
  if (seasons.length === 0) return fromDb;
  try {
    const supabase = createSupabaseServerClient();
    const { data, error } = await supabase
      .from("team_season_managers")
      .select("season, manager_display_name")
      .eq("team_slug", slug)
      .in("season", seasons);
    if (!error && data?.length) {
      for (const row of data) {
        const s = Number(row.season);
        if (s !== 1 && s !== 2 && s !== 3) continue;
        const raw = row.manager_display_name;
        const t =
          raw == null || String(raw).trim() === ""
            ? null
            : String(raw).trim();
        fromDb.set(s, t);
      }
    }
  } catch {
    /* table missing / env — use seed only */
  }
  return fillManagerNamesFromSeed(
    slug,
    [...seasons].sort((a, b) => a - b),
    fromDb,
  );
}

async function lookupPlayerByRobloxUsername(
  robloxUsername: string,
): Promise<TeamPlayerRow | null> {
  const term = robloxUsername.trim();
  if (!term) return null;
  try {
    const supabase = createSupabaseServerClient();
    const { data, error } = await supabase
      .from("players")
      .select("id, roblox_username, roblox_user_id, position")
      .ilike("roblox_username", term)
      .maybeSingle();
    if (error || !data) return null;
    return data as TeamPlayerRow;
  } catch {
    return null;
  }
}

function seasonsForTeamStats(
  selectedSeason: number | null,
  teamSeasons: number[],
): number[] {
  if (selectedSeason !== null) return [selectedSeason];
  return [...teamSeasons].sort((a, b) => a - b);
}

function labelSeasonsSuffix(seasons: number[]): string {
  if (seasons.length === 0) return "";
  return seasons.map((s) => `S${s}`).join(" + ");
}

async function getTeamPlayers(
  slug: string,
  season: number | null,
): Promise<TeamPlayerRow[]> {
  try {
    const supabase = createSupabaseServerClient();
    let linksQuery = supabase
      .from("player_team_seasons")
      .select("player_id")
      .eq("team_slug", slug);
    if (season !== null) {
      linksQuery = linksQuery.eq("season", season);
    }
    const links = await linksQuery;
    if (links.error) return [];

    const ids = [...new Set((links.data ?? []).map((r) => r.player_id))];
    if (ids.length === 0) return [];

    const playersResult = await supabase
      .from("players")
      .select("id, roblox_username, roblox_user_id, position")
      .in("id", ids)
      .order("roblox_username", { ascending: true });
    if (playersResult.error) return [];
    return ((playersResult.data ?? []) as TeamPlayerRow[]).filter(
      (p) =>
        p.roblox_user_id != null &&
        String(p.roblox_user_id).trim() !== "",
    );
  } catch {
    return [];
  }
}

export async function generateStaticParams() {
  const slugs = await getAllTeamSlugs();
  return slugs.map((slug) => ({ slug }));
}

type TeamPageParams = { slug: string };
type TeamPageSearchParams = { season?: string };

export async function generateMetadata({
  params,
}: {
  params: Promise<TeamPageParams>;
}): Promise<Metadata> {
  const { slug } = await params;
  const team = await getTeamBySlugFromDb(slug);
  if (!team) return { title: "Team not found · VF" };
  return {
    title: `${team.name} · VF League Database`,
    description: `${team.name} squad, records, and season history on VF.`,
  };
}

export default async function TeamDetailPage({
  params,
  searchParams,
}: {
  params: Promise<TeamPageParams>;
  searchParams: Promise<TeamPageSearchParams>;
}) {
  const { slug } = await params;
  const { season: seasonParam } = await searchParams;
  const team = await getTeamBySlugFromDb(slug);
  if (!team) notFound();

  const parsedSeason = Number.parseInt(seasonParam ?? "", 10);
  const selectedSeason =
    Number.isFinite(parsedSeason) && teamHasSeason(team.seasons, parsedSeason)
      ? parsedSeason
      : null;

  const players = await getTeamPlayers(slug, selectedSeason);

  const managerSeasons =
    selectedSeason != null ? [selectedSeason] : [...team.seasons].sort((a, b) => a - b);
  const managerNamesBySeason = await getTeamSeasonManagersBySeason(
    slug,
    managerSeasons,
  );

  type ResolvedManager = {
    season: number;
    name: string | null;
    displayName: string | null;
    headshotUserId: string | null;
    profileHref: string | null;
  };

  const resolvedManagers: ResolvedManager[] = await Promise.all(
    managerSeasons.map(async (season) => {
      const raw = managerNamesBySeason.get(season) ?? null;
      const name = raw && raw.trim() !== "" ? raw.trim() : null;
      if (!name) {
        return {
          season,
          name: null,
          displayName: null,
          headshotUserId: null,
          profileHref: null,
        };
      }
      const player = await lookupPlayerByRobloxUsername(name);
      const robloxId =
        player?.roblox_user_id && isVerifiedRobloxUserId(player.roblox_user_id)
          ? player.roblox_user_id.trim()
          : null;
      const displayName = player?.roblox_username?.trim() || name;
      return {
        season,
        name,
        displayName,
        headshotUserId: robloxId,
        profileHref:
          player && robloxId
            ? `/players/${encodeURIComponent(player.roblox_username)}`
            : null,
      };
    }),
  );

  const playerIdsForHeadshots = [
    ...players
      .map((player) => player.roblox_user_id)
      .filter((id): id is string => id != null && id !== ""),
    ...resolvedManagers
      .map((m) => m.headshotUserId)
      .filter((id): id is string => id != null && id !== ""),
  ];
  const headshotsMap = await getRobloxHeadshots(playerIdsForHeadshots);
  const headshots = Object.fromEntries(headshotsMap);

  const statsSeasons = seasonsForTeamStats(selectedSeason, team.seasons);
  const seasonSuffix = labelSeasonsSuffix(statsSeasons);
  const seasonRecord =
    statsSeasons.length > 0
      ? await getTeamSeasonRecordsForSeasons(slug, statsSeasons)
      : null;
  const recordLabel = formatSeasonRecord(seasonRecord);
  const recordCardLabel =
    seasonSuffix.length > 0 ? `Record · ${seasonSuffix}` : "Record";

  const honorRows =
    statsSeasons.length > 0
      ? await getTeamSeasonHonorsForSeasons(slug, statsSeasons)
      : [];
  const titlesCardLabel =
    seasonSuffix.length > 0 ? `Titles · ${seasonSuffix}` : "Titles";

  return (
    <main className="relative min-h-dvh min-w-0 w-full overflow-x-clip text-white">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 pb-16 pt-5 sm:px-6 sm:pt-8 md:px-8 md:pt-10">
        <SiteNav active="teams" />

        <Link
          href="/teams"
          className="inline-flex w-fit items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.2em] text-white/65 transition hover:text-white"
        >
          <ArrowLeft className="size-3.5" />
          All teams
        </Link>

        <section className="flex flex-col items-center gap-5 text-center sm:flex-row sm:items-end sm:gap-6 sm:text-left">
          <TeamCrest team={team} size="lg" />
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.32em] text-white/55">
              Club Profile
            </p>
            <h1 className="mt-2 text-4xl font-semibold tracking-tight sm:text-5xl">
              {team.name}
            </h1>
            <p className="mt-2 text-sm text-white/65">{team.form}</p>
            <div className="mt-3 flex flex-wrap justify-center gap-1.5 sm:justify-start">
              <SeasonPill
                slug={team.slug}
                value="all"
                label="All Seasons"
                active={selectedSeason === null}
              />
              {team.seasons.map((s) => (
                <SeasonPill
                  key={s}
                  slug={team.slug}
                  value={String(s)}
                  label={`Season ${s}`}
                  active={selectedSeason === s}
                />
              ))}
            </div>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Card className="gap-2 py-5">
            <CardContent>
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/55">
                {recordCardLabel}
              </p>
              <p className="mt-2 text-2xl font-semibold text-white">
                {recordLabel}
              </p>
            </CardContent>
          </Card>
          <Card className="gap-2 py-5">
            <CardContent>
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/55">
                Squad Size
              </p>
              <p className="mt-2 text-2xl font-semibold text-white">
                {String(players.length)}
              </p>
            </CardContent>
          </Card>
          <Card className="gap-2 py-5">
            <CardContent>
              <div className="flex flex-wrap items-center gap-2">
                <div
                  className="flex size-7 shrink-0 items-center justify-center rounded-md bg-amber-400/15 text-base leading-none ring-1 ring-amber-300/25"
                  aria-hidden
                >
                  🏆
                </div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/55">
                  {titlesCardLabel}
                </p>
              </div>
              {honorRows.length === 0 ? (
                <p className="mt-2 text-2xl font-semibold text-white">—</p>
              ) : (
                <ul className="mt-2 flex flex-col gap-2">
                  {honorRows.map((h) => (
                    <li
                      key={h.honorKind}
                      className="flex items-center gap-2.5"
                    >
                      <TrophyHonorIcon honorKind={h.honorKind} />
                      <span className="min-w-0 text-sm font-semibold leading-snug text-white">
                        {h.label}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </section>

        <section className="flex flex-col gap-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.32em] text-white/55">
              {selectedSeason != null || resolvedManagers.length === 1
                ? "Manager"
                : "Managers"}
            </p>
            <h2 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">
              {selectedSeason != null
                ? `Season ${selectedSeason}`
                : "All seasons"}
            </h2>
            <p className="mt-1 max-w-2xl text-sm text-white/55">
              {selectedSeason != null
                ? "Head coach for the season you've selected."
                : "Head coach for every season this club has registered."}
            </p>
          </div>

          <div
            className={`grid gap-3 ${
              resolvedManagers.length > 1
                ? "sm:grid-cols-2 lg:grid-cols-3"
                : ""
            }`}
          >
            {resolvedManagers.map((manager) => (
              <TeamManagerProfileCard
                key={manager.season}
                displayManagerName={manager.displayName}
                managerHeadshot={
                  manager.headshotUserId
                    ? headshots[manager.headshotUserId]
                    : undefined
                }
                managerProfileHref={manager.profileHref}
                season={manager.season}
              />
            ))}
          </div>
        </section>

        <section className="flex flex-col gap-4">
          <div className="flex items-end justify-between">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.32em] text-white/55">
                Squad
              </p>
              <h2 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">
                {selectedSeason
                  ? `Season ${selectedSeason} squad`
                  : "All players"}
              </h2>
            </div>
            <Badge
              variant="outline"
              className="border-white/15 text-white/75"
            >
              {players.length}{" "}
              {players.length === 1 ? "player" : "players"}
            </Badge>
          </div>

          {players.length === 0 ? (
            <Card className="py-10">
              <CardContent className="flex flex-col items-center gap-2 text-center">
                <p className="text-sm font-semibold text-white">
                  {selectedSeason
                    ? `No squad logged for Season ${selectedSeason}.`
                    : "No squad assigned yet."}
                </p>
                <p className="max-w-md text-xs text-white/55">
                  Roster rows come from{" "}
                  <code className="rounded bg-white/10 px-1.5 py-0.5 text-white/80">
                    player_team_seasons
                  </code>{" "}
                  for this club and season filter. After importing matches, run{" "}
                  <code className="rounded bg-white/10 px-1.5 py-0.5 text-white/80">
                    npm run db:fill:s1-squads
                  </code>{" "}
                  or{" "}
                  <code className="rounded bg-white/10 px-1.5 py-0.5 text-white/80">
                    npm run db:fill:s2-squads
                  </code>{" "}
                  to seed squads from scorers and assisters (Roblox id only).
                </p>
              </CardContent>
            </Card>
          ) : (
            <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {players.map((player) => {
                const headshot = player.roblox_user_id
                  ? headshots[player.roblox_user_id]
                  : undefined;
                return (
                  <Link
                    key={player.id}
                    href={`/players/${encodeURIComponent(player.roblox_username)}`}
                    className="block rounded-xl outline-none transition focus-visible:ring-2 focus-visible:ring-white/40"
                  >
                    <Card className="gap-0 py-0 transition hover:bg-white/[0.07] hover:ring-white/25">
                      <div className="flex items-center gap-3 px-4 py-4">
                        <Avatar
                          size="lg"
                          className="bg-[#083696]/40 ring-1 ring-white/15"
                        >
                          {headshot ? (
                            <AvatarImage
                              src={headshot}
                              alt={`${player.roblox_username} headshot`}
                            />
                          ) : null}
                          <AvatarFallback className="bg-[#083696] text-sm font-black uppercase text-white">
                            {player.roblox_username.slice(0, 2)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-base font-semibold text-white">
                            {player.roblox_username}
                          </p>
                          <p className="truncate text-xs text-white/55">
                            {player.position ?? "Position unset"}
                          </p>
                        </div>
                      </div>
                    </Card>
                  </Link>
                );
              })}
            </section>
          )}
        </section>

        <Card className="gap-3 py-5">
          <CardHeader>
            <CardTitle className="text-base font-semibold">
              About {team.name}
            </CardTitle>
            <CardDescription className="text-white/55">
              Club records and history.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2 sm:grid-cols-2">
              <Row label="Short Name" value={team.short} />
              <Row label="Slug" value={team.slug} />
              <Row label="Form" value={team.form} />
              <Row
                label="Seasons"
                value={team.seasons.map((s) => `S${s}`).join(" · ")}
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

function TeamManagerProfileCard({
  displayManagerName,
  managerHeadshot,
  managerProfileHref,
  season,
}: {
  displayManagerName: string | null;
  managerHeadshot: string | undefined;
  managerProfileHref: string | null;
  season: number;
}) {
  const isMissing = !displayManagerName;
  const managerInitials = displayManagerName
    ? displayManagerName.slice(0, 2).toUpperCase()
    : "—";
  const card = (
    <Card
      className={`gap-0 py-0 ${
        managerProfileHref
          ? "transition hover:bg-white/[0.07] hover:ring-white/25"
          : ""
      }`}
    >
      <div className="flex items-center gap-3 px-4 py-4">
        <Avatar
          size="lg"
          className="bg-[#083696]/40 ring-1 ring-white/15"
        >
          {managerHeadshot ? (
            <AvatarImage
              src={managerHeadshot}
              alt={`${displayManagerName ?? "Manager"} headshot`}
            />
          ) : null}
          <AvatarFallback className="bg-[#083696] text-sm font-black uppercase text-white">
            {managerInitials}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <p
            className={`truncate text-base font-semibold ${
              isMissing ? "text-white/55" : "text-white"
            }`}
          >
            {displayManagerName ?? "No manager on file"}
          </p>
          <p className="truncate text-xs text-white/55">
            Head coach · Season {season}
            {managerProfileHref ? " · VF profile" : ""}
          </p>
        </div>
      </div>
    </Card>
  );

  if (managerProfileHref) {
    return (
      <Link
        href={managerProfileHref}
        className="block rounded-xl outline-none transition focus-visible:ring-2 focus-visible:ring-white/40"
      >
        {card}
      </Link>
    );
  }
  return <div>{card}</div>;
}

function SeasonPill({
  slug,
  value,
  label,
  active,
}: {
  slug: string;
  value: "all" | string;
  label: string;
  active: boolean;
}) {
  const href = value === "all" ? `/teams/${slug}` : `/teams/${slug}?season=${value}`;
  return (
    <Link
      href={href}
      scroll={false}
      aria-pressed={active}
      className={`inline-flex h-6 items-center rounded-full border px-2.5 text-[11px] font-semibold transition ${
        active
          ? "border-white bg-white text-[#02103f] shadow-[0_4px_16px_-4px_rgba(255,255,255,0.4)]"
          : "border-white/15 text-white/70 hover:border-white/35 hover:text-white"
      }`}
    >
      {label}
    </Link>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-md border border-white/10 bg-[#12326e]/48 px-3 py-2">
      <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/55">
        {label}
      </span>
      <span className="truncate pl-3 text-right text-sm font-medium text-white">
        {value}
      </span>
    </div>
  );
}
