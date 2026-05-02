import { SiteNav } from "@/components/site-nav";

import { TournamentsArchive } from "../tournaments-archive";
import { StatsSectionNav } from "../stats-section-nav";

export default function StatsTournamentsPage() {
  return (
    <main className="relative min-h-screen w-full overflow-hidden text-white">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-5 pb-16 pt-6 sm:px-8 sm:pt-10">
        <SiteNav active="stats" />
        <StatsSectionNav />
        <div className="flex flex-col gap-10">
          <TournamentsArchive />
        </div>
      </div>
    </main>
  );
}
