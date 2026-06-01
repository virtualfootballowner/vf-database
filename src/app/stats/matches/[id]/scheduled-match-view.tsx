import Link from "next/link";

import type { MatchRecord } from "@/app/stats/matches-data";
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
import { formatWcKickoff } from "@/lib/wc-fixture-kickoff";
import { cn } from "@/lib/utils";

const matchSurfaceClass =
  "border-0 bg-white/[0.035] shadow-none ring-1 ring-white/[0.08] backdrop-blur-md";
const insetRowClass =
  "rounded-lg bg-white/[0.03] px-3 py-2 ring-1 ring-white/[0.06]";

type GetTeam = (slug: string | null, name: string) => Team;

function refereeLabel(match: MatchRecord): string {
  const ref = match.referee?.trim();
  if (ref && ref !== "—") return ref;
  return "TBD";
}

function TeamHeader({
  team,
  name,
  slug,
  align,
}: {
  team: Team;
  name: string;
  slug: string | null;
  align: "start" | "end";
}) {
  const inner = (
    <div
      className={`flex flex-col items-center gap-2 ${
        align === "end" ? "sm:items-end" : "sm:items-start"
      }`}
    >
      <TeamCrest team={team} size="lg" />
      <p className="text-base font-semibold tracking-tight sm:text-xl">{name}</p>
    </div>
  );
  if (slug) {
    return (
      <Link
        href={`/teams/${slug}`}
        className="rounded-md outline-none transition hover:opacity-90 focus-visible:ring-2 focus-visible:ring-white/40"
      >
        {inner}
      </Link>
    );
  }
  return inner;
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3",
        insetRowClass,
      )}
    >
      <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/45">
        {label}
      </span>
      <span className="truncate text-right text-sm font-medium text-white/85">
        {value}
      </span>
    </div>
  );
}

export function ScheduledMatchView({
  match,
  getTeam,
}: {
  match: MatchRecord;
  getTeam: GetTeam;
}) {
  const home = getTeam(match.homeSlug, match.homeTeam);
  const away = getTeam(match.awaySlug, match.awayTeam);
  const kickoff = match.scheduledAt
    ? formatWcKickoff(match.scheduledAt)
    : { date: match.date || "—", time: "—" };
  const ref = refereeLabel(match);
  const stadium = match.stadium?.trim() || "TBD";

  return (
    <>
      <section className="flex flex-col gap-3 text-center">
        <Badge
          variant="outline"
          className="mx-auto w-fit border-sky-300/35 bg-sky-400/10 text-sky-200"
        >
          Pre-match
        </Badge>

        <div className="flex flex-wrap items-center justify-center gap-1.5 text-xs uppercase tracking-[0.18em] text-white/55">
          <span>{kickoff.date}</span>
          <span aria-hidden>·</span>
          <span className="tabular-nums normal-case tracking-[0.04em]">
            {kickoff.time}
          </span>
        </div>

        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4 sm:gap-8">
          <TeamHeader
            team={home}
            name={match.homeTeam}
            slug={match.homeSlug}
            align="end"
          />
          <div className="flex flex-col items-center gap-1">
            <span className="text-2xl font-semibold text-white/35 sm:text-3xl">
              vs
            </span>
            {match.stage !== "Group" ? (
              <Badge variant="outline" className="border-white/15 text-white/75">
                {match.stage}
              </Badge>
            ) : null}
          </div>
          <TeamHeader
            team={away}
            name={match.awayTeam}
            slug={match.awaySlug}
            align="start"
          />
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
          <Badge
            variant="outline"
            className="border-violet-300/30 bg-violet-400/10 text-violet-100"
          >
            Ref · {ref}
          </Badge>
          <Badge variant="outline" className="border-white/15 text-white/65">
            {stadium}
          </Badge>
        </div>

        {match.notes ? (
          <p className="mx-auto max-w-2xl text-sm text-white/55">{match.notes}</p>
        ) : null}
      </section>

      <Card className={cn("gap-3 py-5", matchSurfaceClass)}>
        <CardHeader>
          <CardTitle className="text-base font-semibold text-white/90">
            Fixture details
          </CardTitle>
          <CardDescription className="text-white/50">
            Full report and events will appear here after the match is played.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2 sm:grid-cols-2">
            <InfoRow label="Match ID" value={match.id} />
            <InfoRow label="Kickoff" value={kickoff.time} />
            <InfoRow label="Competition" value={match.competition} />
            <InfoRow label="Game week" value={match.gameWeek} />
            <InfoRow label="Stage" value={match.stage} />
            <InfoRow label="Referee" value={ref} />
            <InfoRow label="Stadium" value={stadium} />
            <InfoRow label="Status" value="Scheduled" />
          </div>
        </CardContent>
      </Card>
    </>
  );
}
