import { SiteNav } from "@/components/site-nav";

import { TeamsList } from "./teams-list";
import { teams } from "./teams-data";

export default function TeamsPage() {
  return (
    <main className="relative min-h-screen w-full overflow-hidden text-white">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-5 pb-16 pt-6 sm:px-8 sm:pt-10">
        <SiteNav active="teams" />

        <section>
          <p className="text-[10px] font-semibold uppercase tracking-[0.32em] text-white/55">
            Clubs
          </p>
          <h1 className="mt-2 text-4xl font-semibold tracking-tight sm:text-5xl">
            Teams
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-white/70 sm:text-base">
            Every club registered in the database. Filter by season or search
            by name to find a specific club.
          </p>
        </section>

        <TeamsList teams={teams} />
      </div>
    </main>
  );
}
