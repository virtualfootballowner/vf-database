import Link from "next/link";

import { TeamCrest } from "@/app/teams/team-crest";
import type { Team } from "@/app/teams/teams-data";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  S3_WORLD_CUP_GROUPS,
  S3_WORLD_CUP_GROUP_LETTERS,
  S3_WORLD_CUP_STRUCTURE,
} from "@/lib/s3-world-cup-fixtures";

const TEAMS_PER_GROUP = S3_WORLD_CUP_STRUCTURE.teams_per_group;

export function WorldCupGroupsSection({
  teamBySlug,
}: {
  teamBySlug: Map<string, Team>;
}) {
  return (
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
            {S3_WORLD_CUP_GROUP_LETTERS.length} groups of {TEAMS_PER_GROUP}. Top
            two from each group plus the four best third-place sides reach the
            Round of 16.
          </p>
        </div>
        <Badge
          variant="outline"
          className="h-8 shrink-0 gap-2 border-white/15 bg-white/5 px-3 text-white/85"
        >
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.9)]" />
          Group stages
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
  );
}
