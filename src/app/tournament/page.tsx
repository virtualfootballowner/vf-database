import type { Metadata } from "next";
import Link from "next/link";

import { WorldCupFixturesSection } from "@/app/tournament/world-cup-fixtures-section";
import { SiteNav } from "@/components/site-nav";
import { Badge } from "@/components/ui/badge";
import { S3_WORLD_CUP_STRUCTURE } from "@/lib/s3-world-cup-fixtures";
import { getTeamsCatalog, catalogSliceForFileSeason } from "@/lib/site-db";
import type { Team } from "@/app/teams/teams-data";

export const metadata: Metadata = {
  title: "Fixtures · VF League",
  description:
    "Season 3 World Cup — full fixture schedule from the group stage through the final.",
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
            World <span className="glisten">Cup</span>{" "}
            <span className="text-white/45">fixtures</span>
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-white/70 sm:text-base">
            {pool.length} nations · {S3_WORLD_CUP_STRUCTURE.groups} groups of{" "}
            {TEAMS_PER_GROUP}. Group stage matchdays and knockout schedule —{" "}
            <Link
              href="/stats/tournaments"
              className="font-semibold text-white underline decoration-white/25 underline-offset-4 transition hover:decoration-white/60"
            >
              groups & bracket
            </Link>
            .
          </p>
        </section>

        <WorldCupFixturesSection teamBySlug={teamBySlug} />
      </div>
    </main>
  );
}
