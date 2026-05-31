import { Card, CardContent } from "@/components/ui/card";
import type { Team } from "@/app/teams/teams-data";
import { WorldCupKnockoutBracket } from "@/app/tournament/world-cup-knockout-bracket";

export function WorldCupKnockoutSection({
  teamBySlug,
}: {
  teamBySlug: Map<string, Team>;
}) {
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
          Six groups flank the knockout tree — top two from each group plus the
          four best third-place sides fill the Round of 16.
        </p>
      </div>
      <Card className="overflow-hidden border-white/10 bg-white/[0.03]">
        <CardContent className="p-3 sm:p-5 md:p-6">
          <WorldCupKnockoutBracket teamBySlug={teamBySlug} />
        </CardContent>
      </Card>
    </section>
  );
}
