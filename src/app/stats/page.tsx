import { SiteNav } from "@/components/site-nav";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const leaderboards = [
  {
    title: "Top Scorers",
    description: "Goals scored across all competitions.",
    leader: "TBD",
  },
  {
    title: "Top Assists",
    description: "Most assists across all competitions.",
    leader: "TBD",
  },
  {
    title: "Clean Sheets",
    description: "Goalkeepers with the most shutouts.",
    leader: "TBD",
  },
  {
    title: "MVPs",
    description: "Match-defining performances voted by the league.",
    leader: "TBD",
  },
];

export default function StatsPage() {
  return (
    <main className="relative min-h-screen w-full overflow-hidden text-white">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-5 pb-16 pt-6 sm:px-8 sm:pt-10">
        <SiteNav active="stats" />

        <section>
          <p className="text-[10px] font-semibold uppercase tracking-[0.32em] text-white/55">
            League data
          </p>
          <h1 className="mt-2 text-4xl font-semibold tracking-tight sm:text-5xl">
            Stats
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-white/70 sm:text-base">
            Leaderboards, season averages, and match-by-match records. Live
            data hooks up once season events are wired in.
          </p>
        </section>

        <section className="grid gap-4 sm:grid-cols-2">
          {leaderboards.map((board) => (
            <Card key={board.title} className="gap-3 py-5">
              <CardHeader className="flex flex-row items-start justify-between gap-4">
                <div>
                  <CardTitle className="text-xl font-semibold tracking-tight">
                    {board.title}
                  </CardTitle>
                  <CardDescription className="text-white/55">
                    {board.description}
                  </CardDescription>
                </div>
                <Badge
                  variant="outline"
                  className="border-white/15 text-white/75"
                >
                  Coming soon
                </Badge>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between rounded-md border border-white/10 bg-white/5 px-3 py-2.5">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/55">
                    Leader
                  </span>
                  <span className="text-sm font-semibold text-white">
                    {board.leader}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </section>
      </div>
    </main>
  );
}
