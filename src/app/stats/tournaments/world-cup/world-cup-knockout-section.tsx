import { Card, CardContent } from "@/components/ui/card";
import type { MatchRecord } from "@/app/stats/matches-data";
import type { Team } from "@/app/teams/teams-data";
import { buildAllWorldCupGroupBundles } from "@/lib/s3-world-cup-group-standings";

import { WorldCupBracketWithGroups } from "./world-cup-bracket-with-groups";

export function WorldCupKnockoutSection({
  teamBySlug,
  allMatches,
}: {
  teamBySlug: Map<string, Team>;
  allMatches: MatchRecord[];
}) {
  const teamsBySlug = Object.fromEntries(teamBySlug) as Record<string, Team>;
  const teamNamesBySlug = Object.fromEntries(
    [...teamBySlug.entries()].map(([slug, team]) => [slug, team.name]),
  );
  const groupBundles = buildAllWorldCupGroupBundles(allMatches, teamNamesBySlug);

  return (
    <section className="flex flex-col gap-4">
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-[0.32em] text-white/55">
          Tournament
        </p>
        <h2 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">
          Groups & bracket
        </h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-white/60">
          Six groups flank the knockout tree — tap any group for played, goals,
          and points. Top two from each group plus four best third-place sides
          reach the Round of 16.
        </p>
      </div>
      <Card className="overflow-hidden border-white/10 bg-white/[0.03]">
        <CardContent className="p-3 sm:p-5 md:p-6">
          <WorldCupBracketWithGroups
            teamsBySlug={teamsBySlug}
            groupBundles={groupBundles}
          />
        </CardContent>
      </Card>
    </section>
  );
}
