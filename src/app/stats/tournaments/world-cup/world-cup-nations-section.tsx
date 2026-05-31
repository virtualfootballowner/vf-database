import Link from "next/link";

import { TeamCrest } from "@/app/teams/team-crest";
import type { Team } from "@/app/teams/teams-data";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

export function WorldCupNationsSection({
  teams,
  season,
}: {
  teams: Team[];
  season: number;
}) {
  return (
    <section className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.32em] text-white/55">
            Competition
          </p>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">
            Nations
          </h2>
          <p className="mt-2 max-w-xl text-sm leading-6 text-white/65">
            All {teams.length} qualified sides in Season {season}.
          </p>
        </div>
        <Badge
          variant="outline"
          className="h-8 shrink-0 gap-2 border-white/15 bg-white/5 px-3 text-white/85"
        >
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.9)]" />
          {teams.length} teams
        </Badge>
      </div>

      {teams.length === 0 ? (
        <Card className="py-10">
          <CardContent className="text-center text-sm text-white/65">
            No Season {season} teams are registered yet.
          </CardContent>
        </Card>
      ) : (
        <Card className="border-white/10 bg-white/[0.04] backdrop-blur">
          <CardContent className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-3 sm:gap-4 sm:p-6 md:grid-cols-4 lg:grid-cols-6">
            {teams.map((team) => (
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
  );
}
