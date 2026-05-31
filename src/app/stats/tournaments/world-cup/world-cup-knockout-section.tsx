import { Card, CardContent } from "@/components/ui/card";
import { WorldCupKnockoutBracket } from "@/app/tournament/world-cup-knockout-bracket";

export function WorldCupKnockoutSection() {
  return (
    <section className="flex flex-col gap-4">
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-[0.32em] text-white/55">
          Knockouts
        </p>
        <h2 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">
          Road to the final
        </h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-white/60">
          Bracket slots fill in as the group stage completes — group winners,
          runners-up, and the four best third-place sides.
        </p>
      </div>
      <Card className="overflow-hidden border-white/10 bg-white/[0.03]">
        <CardContent className="p-3 sm:p-5 md:p-6">
          <WorldCupKnockoutBracket />
        </CardContent>
      </Card>
    </section>
  );
}
