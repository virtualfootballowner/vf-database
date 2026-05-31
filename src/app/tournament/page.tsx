import type { Metadata } from "next";
import Link from "next/link";

import { SiteNav } from "@/components/site-nav";
import { TeamCrest } from "@/app/teams/team-crest";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { WorldCupKnockoutBracket } from "@/app/tournament/world-cup-knockout-bracket";
import { WorldCupFixturesSection } from "@/app/tournament/world-cup-fixtures-section";
import {
  S3_WORLD_CUP_GROUPS,
  S3_WORLD_CUP_GROUP_LETTERS,
  S3_WORLD_CUP_STRUCTURE,
} from "@/lib/s3-world-cup-fixtures";
import { getTeamsCatalog, catalogSliceForFileSeason } from "@/lib/site-db";
import type { Team } from "@/app/teams/teams-data";

export const metadata: Metadata = {
  title: "Fixtures · VF League",
  description:
    "Season 3 World Cup — 24 nations, six groups of four, top 16 advance to the Round of 16.",
};

export const dynamic = "force-dynamic";

const TOURNAMENT_SEASON = 3;
const TEAMS_PER_GROUP = S3_WORLD_CUP_STRUCTURE.teams_per_group;

export default async function TournamentPage() {
  const { teams } = await getTeamsCatalog();
  const pool = catalogSliceForFileSeason(teams, TOURNAMENT_SEASON);
  const teamBySlug = new Map<string, Team>(
    teams.filter((t) => t.slug).map((t) => [t.slug, t]),
  );
  const groupsDrawn = S3_WORLD_CUP_GROUP_LETTERS.length;

  return (
    <main className="relative min-h-dvh min-w-0 w-full overflow-x-clip text-white">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-12 px-4 pb-20 pt-5 sm:px-6 sm:pt-8 md:px-8 md:pt-10">
        <SiteNav active="tournament" />

        <section className="relative pt-8 sm:pt-12">
          <div className="flex items-center gap-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.32em] text-white/55">
              Season 3
            </p>
            <span aria-hidden className="h-px w-10 bg-white/20" />
            <Badge
              variant="outline"
              className="h-6 gap-2 border-white/15 bg-white/5 px-2 text-[10px] uppercase tracking-[0.18em] text-white/70"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.9)]" />
              Draw complete
            </Badge>
          </div>
          <h1 className="mt-3 text-4xl font-semibold leading-[1.05] tracking-tight sm:text-6xl">
            World <span className="glisten">Cup</span>
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-white/70 sm:text-base">
            {pool.length} nations · {S3_WORLD_CUP_STRUCTURE.groups} groups of{" "}
            {TEAMS_PER_GROUP}. Top two from every group qualify, plus the best
            four third-place sides —{" "}
            <strong className="font-semibold text-white">
              {S3_WORLD_CUP_STRUCTURE.knockout_advancers_total} teams
            </strong>{" "}
            into the Round of 16.
          </p>
        </section>

        <WorldCupFixturesSection teamBySlug={teamBySlug} />

        <section className="flex flex-col gap-5">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.32em] text-white/55">
                Pool
              </p>
              <h2 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">
                Qualified nations
              </h2>
            </div>
            <Badge
              variant="outline"
              className="h-8 shrink-0 gap-2 border-white/15 bg-white/5 px-3 text-white/85"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.9)]" />
              {pool.length} teams · draw complete
            </Badge>
          </div>

          {pool.length === 0 ? (
            <Card className="py-10">
              <CardContent className="text-center text-sm text-white/65">
                No Season {TOURNAMENT_SEASON} teams are registered yet.
              </CardContent>
            </Card>
          ) : (
            <Card className="border-white/10 bg-white/[0.04] backdrop-blur">
              <CardContent className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-3 sm:gap-4 sm:p-6 md:grid-cols-4 lg:grid-cols-6">
                {pool.map((team) => (
                  <Link
                    key={team.slug}
                    href={`/teams/${team.slug}`}
                    className="group flex flex-col items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.03] p-3 text-center outline-none transition hover:-translate-y-0.5 hover:border-white/20 hover:bg-white/[0.07] focus-visible:ring-2 focus-visible:ring-white/40 sm:p-4"
                  >
                    <TeamCrest team={team} size="md" />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold tracking-tight text-white">
                        {team.name}
                      </p>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/45">
                        {team.short}
                      </p>
                    </div>
                  </Link>
                ))}
              </CardContent>
            </Card>
          )}
        </section>

        <section className="flex flex-col gap-5">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.32em] text-white/55">
                Group stage
              </p>
              <h2 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">
                Groups
              </h2>
              <p className="mt-2 max-w-xl text-sm leading-6 text-white/65">
                {S3_WORLD_CUP_GROUP_LETTERS.length} groups of {TEAMS_PER_GROUP}.
                Every group sends its top two through; four more third-place
                teams join them in the Round of 16.
              </p>
            </div>
            <Badge
              variant="outline"
              className="h-8 shrink-0 gap-2 border-white/15 bg-white/5 px-3 text-white/85"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.9)]" />
              {groupsDrawn} / {S3_WORLD_CUP_GROUP_LETTERS.length} drawn
            </Badge>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {S3_WORLD_CUP_GROUP_LETTERS.map((letter) => {
              const slugs = S3_WORLD_CUP_GROUPS[letter];
              const groupTeams = slugs
                .map((slug) => teamBySlug.get(slug))
                .filter((team): team is Team => Boolean(team));

              return (
              <Card
                key={letter}
                className="gap-3 border-white/10 bg-white/[0.03] py-4 transition hover:bg-white/[0.05]"
              >
                <CardHeader className="flex flex-row items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="font-display flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-white/5 text-lg font-semibold tracking-wide text-white">
                      {letter}
                    </span>
                    <div>
                      <CardTitle className="text-base font-semibold tracking-tight">
                        Group {letter}
                      </CardTitle>
                      <CardDescription className="text-[11px] uppercase tracking-[0.2em] text-white/45">
                        {TEAMS_PER_GROUP} nations
                      </CardDescription>
                    </div>
                  </div>
                  <Badge
                    variant="outline"
                    className="h-6 border-white/15 bg-white/[0.04] px-2 text-[10px] uppercase tracking-[0.18em] text-white/70"
                  >
                    {TEAMS_PER_GROUP} / {TEAMS_PER_GROUP}
                  </Badge>
                </CardHeader>
                <CardContent className="flex flex-col gap-2">
                  {groupTeams.map((team, idx) => (
                    <Link
                      key={team.slug}
                      href={`/teams/${team.slug}`}
                      className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 outline-none transition hover:border-white/20 hover:bg-white/[0.07] focus-visible:ring-2 focus-visible:ring-white/40"
                    >
                      <span className="font-display flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.06] text-[11px] font-semibold text-white/60">
                        {idx + 1}
                      </span>
                      <TeamCrest team={team} size="sm" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold tracking-tight text-white">
                          {team.name}
                        </p>
                        {team.short ? (
                          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/45">
                            {team.short}
                          </p>
                        ) : null}
                      </div>
                    </Link>
                  ))}
                </CardContent>
              </Card>
            );
            })}
          </div>
        </section>

        <section className="flex flex-col gap-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.32em] text-white/55">
              Knockouts
            </p>
            <h2 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">
              Road to the final
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-white/60">
              Slot labels follow the official bracket — group winners and
              runners-up, plus the four best third-place sides.
            </p>
          </div>
          <Card className="overflow-hidden border-white/10 bg-white/[0.03]">
            <CardContent className="p-3 sm:p-5 md:p-6">
              <WorldCupKnockoutBracket />
            </CardContent>
          </Card>
        </section>
      </div>
    </main>
  );
}
