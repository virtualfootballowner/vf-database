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
    <section>
      <Card className="overflow-hidden border-white/10 bg-white/[0.03]">
        <CardContent className="p-3 sm:p-5 md:p-6">
          <WorldCupBracketWithGroups
            teamsBySlug={teamsBySlug}
            groupBundles={groupBundles}
            allMatches={allMatches}
          />
        </CardContent>
      </Card>
    </section>
  );
}
