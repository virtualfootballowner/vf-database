import { SiteNav } from "@/components/site-nav";

import { TournamentsArchive } from "../tournaments-archive";
import { StatsSectionNav } from "../stats-section-nav";

export default function StatsTournamentsPage() {
  return (
    <main className="relative min-h-dvh min-w-0 w-full overflow-x-clip text-white">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 pb-16 pt-5 sm:px-6 sm:pt-8 md:px-8 md:pt-10">
        <SiteNav active="stats" />
        <StatsSectionNav />
        <div className="flex flex-col gap-10">
          <TournamentsArchive />
        </div>
      </div>
    </main>
  );
}
