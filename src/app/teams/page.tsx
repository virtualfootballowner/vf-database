import { SiteNav } from "@/components/site-nav";
import { getTeamsCatalog } from "@/lib/site-db";

import { TeamsList } from "./teams-list";

export default async function TeamsPage() {
  const { teams } = await getTeamsCatalog();
  return (
    <main className="relative min-h-dvh min-w-0 w-full overflow-x-clip text-white">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 pb-16 pt-5 sm:px-6 sm:pt-8 md:px-8 md:pt-10">
        <SiteNav active="teams" />

        <section>
          <p className="text-[10px] font-semibold uppercase tracking-[0.32em] text-white/55">
            League &amp; nations
          </p>
          <h1 className="mt-2 text-4xl font-semibold tracking-tight sm:text-5xl">
            Teams
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-white/70 sm:text-base">
            League clubs for Seasons 1–2 and national squads for Season 3.
            Filter by season or search by name.
          </p>
        </section>

        <TeamsList teams={teams} />
      </div>
    </main>
  );
}
