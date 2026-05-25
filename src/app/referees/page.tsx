import type { Metadata } from "next";

import { RefereesList } from "@/app/referees/referees-list";
import { SiteNav } from "@/components/site-nav";
import { getRobloxHeadshots, isVerifiedRobloxUserId } from "@/lib/roblox";
import { listRefereesForSite } from "@/lib/referees/site-referees";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Referees · VF League",
  description:
    "Official VF League referee roster — Roblox profiles and assignment history from the referee program database.",
  openGraph: {
    title: "Referees · VF League",
    description: "Active VF League referees and their assignment counts.",
  },
  robots: { index: true, follow: true },
};

export default async function RefereesPage() {
  const referees = await listRefereesForSite();
  const robloxIds = referees
    .map((r) => r.roblox_user_id)
    .filter(isVerifiedRobloxUserId);
  const headshotsMap = await getRobloxHeadshots(robloxIds);
  const headshots = Object.fromEntries(headshotsMap);

  return (
    <main className="relative min-h-dvh min-w-0 w-full overflow-x-clip text-white">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 pb-16 pt-5 sm:px-6 sm:pt-8 md:px-8 md:pt-10">
        <SiteNav active="referees" />

        <section>
          <p className="text-[10px] font-semibold uppercase tracking-[0.32em] text-white/55">
            Officiating
          </p>
          <h1 className="mt-2 text-4xl font-semibold tracking-tight sm:text-5xl">
            Referees
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-white/70 sm:text-base">
            Active VF League referees from the officiating database. Rosters sync
            when staff approve applications in the referee Discord and when refs
            claim fixtures.
          </p>
        </section>

        <RefereesList referees={referees} headshots={headshots} />
      </div>
    </main>
  );
}
