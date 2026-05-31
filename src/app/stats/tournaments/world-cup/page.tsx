import type { Metadata } from "next";
import Link from "next/link";

import { WorldCupFixturesSection } from "@/app/tournament/world-cup-fixtures-section";
import { SiteNav } from "@/components/site-nav";
import { Badge } from "@/components/ui/badge";
import { getTeamsCatalog } from "@/lib/site-db";
import type { Team } from "@/app/teams/teams-data";
import { S3_WORLD_CUP_STRUCTURE } from "@/lib/s3-world-cup-fixtures";

import { StatsSectionNav } from "../../stats-section-nav";
import { WorldCupGroupsSection } from "./world-cup-groups-section";
import { WorldCupKnockoutSection } from "./world-cup-knockout-section";

export const metadata: Metadata = {
  title: "World Cup · VF League",
  description:
    "Season 3 World Cup — fixtures, groups, and knockout bracket.",
};

export const dynamic = "force-dynamic";

export default async function WorldCupTournamentPage() {
  const { teams } = await getTeamsCatalog();
  const teamBySlug = new Map<string, Team>(
    teams.filter((t) => t.slug).map((t) => [t.slug, t]),
  );

  return (
    <main className="relative min-h-dvh min-w-0 w-full overflow-x-clip text-white">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-12 px-4 pb-20 pt-5 sm:px-6 sm:pt-8 md:px-8 md:pt-10">
        <SiteNav active="stats" />
        <StatsSectionNav />

        <section className="relative pt-4 sm:pt-6">
          <Link
            href="/stats/tournaments"
            className="text-[10px] font-semibold uppercase tracking-[0.28em] text-white/45 transition hover:text-white/70"
          >
            ← Tournaments
          </Link>
          <div className="mt-4 flex items-center gap-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.32em] text-white/55">
              Season 3
            </p>
            <span aria-hidden className="h-px w-10 bg-white/20" />
            <Badge
              variant="outline"
              className="h-6 gap-2 border-white/15 bg-white/5 px-2 text-[10px] uppercase tracking-[0.18em] text-white/70"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.9)]" />
              Live
            </Badge>
          </div>
          <h1 className="mt-3 text-4xl font-semibold leading-[1.05] tracking-tight sm:text-6xl">
            World <span className="glisten">Cup</span>
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-white/70 sm:text-base">
            {S3_WORLD_CUP_STRUCTURE.groups} groups ·{" "}
            {S3_WORLD_CUP_STRUCTURE.knockout_advancers_total} into the Round of
            16 · final 2 July.
          </p>
        </section>

        <WorldCupFixturesSection teamBySlug={teamBySlug} />
        <WorldCupGroupsSection teamBySlug={teamBySlug} />
        <WorldCupKnockoutSection />
      </div>
    </main>
  );
}
