import Link from "next/link";

import { TeamCrest } from "@/app/teams/team-crest";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { MatchPageContext } from "@/lib/match-page-context";
import { formatWcKickoff } from "@/lib/wc-fixture-kickoff";
import { cn } from "@/lib/utils";

const matchSurfaceClass =
  "border-0 bg-white/[0.035] shadow-none ring-1 ring-white/[0.08] backdrop-blur-md";
const insetRowClass =
  "rounded-lg bg-white/[0.03] px-3 py-2 ring-1 ring-white/[0.06]";

function officialLabel(value: string | null | undefined): string {
  const v = value?.trim();
  return v && v !== "—" ? v : "TBD";
}

function TeamSideCard({
  side,
  align,
}: {
  side: MatchPageContext["home"];
  align: "home" | "away";
}) {
  const manager = side.manager?.trim() || "TBD";

  return (
    <Card className={cn("gap-0 py-0", matchSurfaceClass)}>
      <CardContent className="flex flex-col gap-4 p-4 sm:p-5">
        <div
          className={`flex items-center gap-3 ${
            align === "away" ? "flex-row-reverse text-right" : ""
          }`}
        >
          {side.slug ? (
            <Link
              href={`/teams/${side.slug}`}
              className="shrink-0 outline-none transition hover:opacity-90 focus-visible:ring-2 focus-visible:ring-white/40"
            >
              <TeamCrest team={side.team} size="md" />
            </Link>
          ) : (
            <TeamCrest team={side.team} size="md" />
          )}
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/45">
              {align === "home" ? "Home" : "Away"}
            </p>
            {side.slug ? (
              <Link
                href={`/teams/${side.slug}`}
                className="mt-0.5 block truncate text-lg font-semibold tracking-tight text-white outline-none hover:underline focus-visible:ring-2 focus-visible:ring-white/40"
              >
                {side.name}
              </Link>
            ) : (
              <p className="mt-0.5 truncate text-lg font-semibold tracking-tight text-white">
                {side.name}
              </p>
            )}
            <p className="mt-1 text-sm text-white/55">
              Manager · <span className="font-medium text-white/80">{manager}</span>
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className={cn("flex items-center justify-between gap-3", insetRowClass)}>
      <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/45">
        {label}
      </span>
      <span className="truncate text-right text-sm font-medium text-white/85">
        {value}
      </span>
    </div>
  );
}

export function MatchupView({ ctx }: { ctx: MatchPageContext }) {
  const { match, home, away, officials } = ctx;
  const kickoff = match.scheduledAt
    ? formatWcKickoff(match.scheduledAt)
    : { date: match.date || "—", time: "—" };
  const stadium = match.stadium?.trim() || "TBD";
  const mainRef = officialLabel(officials.mainRef ?? match.referee);
  const linesman = officialLabel(officials.linesman);

  return (
    <>
      <section className="flex flex-col gap-4 text-center">
        <Badge
          variant="outline"
          className="mx-auto w-fit border-sky-300/35 bg-sky-400/10 text-sky-200"
        >
          Matchup
        </Badge>

        <div className="flex flex-wrap items-center justify-center gap-1.5 text-xs uppercase tracking-[0.18em] text-white/55">
          <span>{kickoff.date}</span>
          <span aria-hidden>·</span>
          <span className="tabular-nums normal-case tracking-[0.04em] text-white/70">
            {kickoff.time}
          </span>
        </div>

        <div className="mx-auto flex flex-wrap items-center justify-center gap-1.5">
          <Badge variant="outline" className="border-white/15 text-white/75">
            S{match.season}
          </Badge>
          <Badge variant="outline" className="border-white/15 text-white/75">
            {match.competition}
          </Badge>
          <Badge variant="outline" className="border-white/15 text-white/75">
            {match.gameWeek}
          </Badge>
          {match.stage !== "Group" ? (
            <Badge variant="outline" className="border-white/15 text-white/75">
              {match.stage}
            </Badge>
          ) : null}
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <TeamSideCard side={home} align="home" />
        <TeamSideCard side={away} align="away" />
      </div>

      <Card className={cn("gap-3 py-5", matchSurfaceClass)}>
        <CardHeader>
          <CardTitle className="text-base font-semibold text-white/90">
            Officials
          </CardTitle>
          <CardDescription className="text-white/50">
            Assigned from the VF Referee server when available.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <div className={cn("flex flex-col gap-1", insetRowClass)}>
            <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-violet-300/80">
              Main referee
            </span>
            <span className="text-lg font-semibold text-white">{mainRef}</span>
          </div>
          <div className={cn("flex flex-col gap-1", insetRowClass)}>
            <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-violet-300/80">
              Linesman
            </span>
            <span className="text-lg font-semibold text-white">{linesman}</span>
          </div>
        </CardContent>
      </Card>

      <Card className={cn("gap-3 py-5", matchSurfaceClass)}>
        <CardHeader>
          <CardTitle className="text-base font-semibold text-white/90">
            Fixture details
          </CardTitle>
          <CardDescription className="text-white/50">
            {match.status === "scheduled"
              ? "Full report and events appear here after the match is played."
              : "Match information from the league archive."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2 sm:grid-cols-2">
            <InfoRow label="Kickoff" value={kickoff.time} />
            <InfoRow label="Stadium" value={stadium} />
            <InfoRow label="Main referee" value={mainRef} />
            <InfoRow label="Linesman" value={linesman} />
            <InfoRow label="Match ID" value={match.id} />
            <InfoRow
              label="Status"
              value={
                match.status === "scheduled"
                  ? "Scheduled"
                  : match.status ?? "Recorded"
              }
            />
          </div>
        </CardContent>
      </Card>

      {match.notes ? (
        <p className="text-center text-sm text-white/55">{match.notes}</p>
      ) : null}
    </>
  );
}
