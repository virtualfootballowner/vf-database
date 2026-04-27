import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { SiteNav } from "@/components/site-nav";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getRobloxHeadshots } from "@/lib/roblox";
import { createSupabaseServerClient } from "@/lib/supabase-server";

import { TeamCrest } from "../team-crest";
import { getTeamBySlug, teams } from "../teams-data";

type TeamPlayerRow = {
  id: string;
  roblox_username: string;
  roblox_user_id: string;
  position: string | null;
  status: string;
};

async function getTeamPlayers(
  slug: string,
  season: number | null,
): Promise<TeamPlayerRow[]> {
  try {
    const supabase = createSupabaseServerClient();
    let query = supabase
      .from("players")
      .select("id, roblox_username, roblox_user_id, position, status")
      .eq("team_slug", slug);

    if (season !== null) {
      query = query.eq("season", season);
    }

    const result = await query.order("roblox_username", { ascending: true });
    if (result.error) return [];
    return (result.data ?? []) as TeamPlayerRow[];
  } catch {
    return [];
  }
}

export async function generateStaticParams() {
  return teams.map((team) => ({ slug: team.slug }));
}

type TeamPageParams = { slug: string };
type TeamPageSearchParams = { season?: string };

export async function generateMetadata({
  params,
}: {
  params: Promise<TeamPageParams>;
}): Promise<Metadata> {
  const { slug } = await params;
  const team = getTeamBySlug(slug);
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
  const team = getTeamBySlug(slug);
  if (!team) notFound();

  const parsedSeason = Number.parseInt(seasonParam ?? "", 10);
  const selectedSeason =
    Number.isFinite(parsedSeason) && team.seasons.includes(parsedSeason)
      ? parsedSeason
      : null;

  const players = await getTeamPlayers(slug, selectedSeason);
  const headshotsMap = await getRobloxHeadshots(
    players.map((player) => player.roblox_user_id),
  );
  const headshots = Object.fromEntries(headshotsMap);

  return (
    <main className="relative min-h-screen w-full overflow-hidden text-white">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-5 pb-16 pt-6 sm:px-8 sm:pt-10">
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

        <section className="grid gap-3 sm:grid-cols-3">
          {[
            { label: "Record", value: "TBD" },
            { label: "Squad Size", value: String(players.length) },
            { label: "Cup", value: "Group Stage" },
          ].map((stat) => (
            <Card key={stat.label} className="gap-2 py-5">
              <CardContent>
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/55">
                  {stat.label}
                </p>
                <p className="mt-2 text-2xl font-semibold text-white">
                  {stat.value}
                </p>
              </CardContent>
            </Card>
          ))}
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
                  Players will appear here once team rosters are wired up in
                  the database. Add a{" "}
                  <code className="rounded bg-white/10 px-1.5 py-0.5 text-white/80">
                    team_slug
                  </code>{" "}
                  column (and a{" "}
                  <code className="rounded bg-white/10 px-1.5 py-0.5 text-white/80">
                    season
                  </code>{" "}
                  column for season filtering) to the players table and tag
                  rows with{" "}
                  <code className="rounded bg-white/10 px-1.5 py-0.5 text-white/80">
                    {team.slug}
                  </code>{" "}
                  to populate this roster.
                </p>
              </CardContent>
            </Card>
          ) : (
            <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {players.map((player) => {
                const headshot = headshots[player.roblox_user_id];
                return (
                  <Card key={player.id} className="gap-0 py-0">
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
                      <Badge
                        variant="outline"
                        className="shrink-0 border-white/15 text-white/65"
                      >
                        {player.status}
                      </Badge>
                    </div>
                  </Card>
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
    <div className="flex items-center justify-between rounded-md border border-white/10 bg-[#02103f]/65 px-3 py-2">
      <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/55">
        {label}
      </span>
      <span className="truncate pl-3 text-right text-sm font-medium text-white">
        {value}
      </span>
    </div>
  );
}
