import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { TeamCrest } from "@/app/teams/team-crest";
import { SiteNav } from "@/components/site-nav";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import { getEventsForMatch, type MatchEvent } from "../../match-events-data";
import {
  getMatchTeam,
  matches,
  type MatchRecord,
} from "../../matches-data";

const DATE_FORMATTER = new Intl.DateTimeFormat("en-GB", {
  weekday: "long",
  day: "2-digit",
  month: "long",
  year: "numeric",
});

function formatDate(value: string): string {
  const date = new Date(`${value}T12:00:00Z`);
  if (Number.isNaN(date.getTime())) return value;
  return DATE_FORMATTER.format(date);
}

export async function generateStaticParams() {
  return matches.map((m) => ({ id: m.id }));
}

type MatchPageParams = { id: string };

export async function generateMetadata({
  params,
}: {
  params: Promise<MatchPageParams>;
}): Promise<Metadata> {
  const { id } = await params;
  const match = matches.find((m) => m.id === id);
  if (!match) return { title: "Match not found · VF" };
  return {
    title: `${match.homeTeam} ${match.homeScore}-${match.awayScore} ${match.awayTeam} · VF`,
    description: `${match.competition} ${match.gameWeek} · ${match.date}`,
  };
}

export default async function MatchDetailPage({
  params,
}: {
  params: Promise<MatchPageParams>;
}) {
  const { id } = await params;
  const match = matches.find((m) => m.id === id);
  if (!match) notFound();

  const events = getEventsForMatch(match.id);
  const home = getMatchTeam(match.homeSlug, match.homeTeam);
  const away = getMatchTeam(match.awaySlug, match.awayTeam);
  const homeWon = match.homeScore > match.awayScore;
  const awayWon = match.awayScore > match.homeScore;
  const isFFT = match.fft !== "No";

  return (
    <main className="relative min-h-screen w-full overflow-hidden text-white">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-5 pb-16 pt-6 sm:px-8 sm:pt-10">
        <SiteNav active="stats" />

        <Link
          href="/stats"
          className="inline-flex w-fit items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.2em] text-white/65 transition hover:text-white"
        >
          <ArrowLeft className="size-3.5" />
          All matches
        </Link>

        <section className="flex flex-col gap-3 text-center">
          <div className="flex flex-wrap items-center justify-center gap-1.5 text-xs uppercase tracking-[0.18em] text-white/55">
            <span>{formatDate(match.date)}</span>
            <span aria-hidden>·</span>
            <span>{match.competition}</span>
            <span aria-hidden>·</span>
            <span>{match.gameWeek}</span>
          </div>

          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4 sm:gap-8">
            <TeamHeader team={home} name={match.homeTeam} slug={match.homeSlug} align="end" />
            <div className="flex flex-col items-center gap-1">
              <div className="flex items-center gap-2 text-5xl font-bold tabular-nums sm:text-6xl">
                <span className={homeWon ? "text-white" : "text-white/55"}>
                  {match.homeScore}
                </span>
                <span className="text-white/30">–</span>
                <span className={awayWon ? "text-white" : "text-white/55"}>
                  {match.awayScore}
                </span>
              </div>
              {match.stage !== "Group" ? (
                <Badge
                  variant="outline"
                  className="border-white/15 text-white/75"
                >
                  {match.stage}
                </Badge>
              ) : null}
            </div>
            <TeamHeader team={away} name={match.awayTeam} slug={match.awaySlug} align="start" />
          </div>

          <div className="mx-auto flex flex-wrap items-center justify-center gap-1.5">
            <Badge variant="outline" className="border-white/15 text-white/75">
              S{match.season}
            </Badge>
            {isFFT ? (
              <Badge className="border border-amber-300/30 bg-amber-400/15 text-amber-200">
                {match.fft === "Mercy"
                  ? "Mercy rule"
                  : match.fft === "Partial"
                    ? "Partial FFT"
                    : "Forfeit"}
              </Badge>
            ) : null}
            {match.referee && match.referee !== "—" ? (
              <Badge variant="outline" className="border-white/15 text-white/65">
                Ref · {match.referee}
              </Badge>
            ) : null}
          </div>

          {match.notes ? (
            <p className="mx-auto max-w-2xl text-sm text-white/55">
              {match.notes}
            </p>
          ) : null}
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <TeamPanel match={match} events={events} side="home" />
          <TeamPanel match={match} events={events} side="away" />
        </section>

        <Card className="gap-3 py-5">
          <CardHeader>
            <CardTitle className="text-base font-semibold">
              Match Info
            </CardTitle>
            <CardDescription className="text-white/55">
              Source data from VFL historical archive.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2 sm:grid-cols-2">
              <Row label="Match ID" value={match.id} />
              <Row label="Season" value={`Season ${match.season}`} />
              <Row label="Competition" value={match.competition} />
              <Row label="Game Week" value={match.gameWeek} />
              <Row label="Stage" value={match.stage} />
              <Row label="Referee" value={match.referee || "—"} />
              <Row label="Date" value={match.date} />
              <Row label="Forfeit" value={match.fft} />
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

function TeamHeader({
  team,
  name,
  slug,
  align,
}: {
  team: ReturnType<typeof getMatchTeam>;
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
      <p className="text-base font-semibold tracking-tight sm:text-xl">
        {name}
      </p>
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

function TeamPanel({
  match,
  events,
  side,
}: {
  match: MatchRecord;
  events: MatchEvent[];
  side: "home" | "away";
}) {
  const teamName = side === "home" ? match.homeTeam : match.awayTeam;
  const slug = side === "home" ? match.homeSlug : match.awaySlug;
  const teamMeta = getMatchTeam(slug, teamName);

  const teamEvents = events.filter((e) => e.team === teamName);
  const goals = teamEvents.filter((e) => e.type === "Goal");
  const ownGoals = teamEvents.filter((e) => e.type === "OG");
  const assists = teamEvents.filter((e) => e.type === "Assist");
  const motm = teamEvents.filter((e) => e.type === "MOTM");
  const yellows = teamEvents.filter((e) => e.type === "Yellow Card");
  const reds = teamEvents.filter((e) => e.type === "Red Card");

  const totalGoalEntries = goals.length + ownGoals.length;

  return (
    <Card className="gap-3 py-5">
      <CardHeader className="flex flex-row items-center gap-3">
        <TeamCrest team={teamMeta} size="sm" />
        <div className="min-w-0">
          <CardTitle className="truncate text-lg font-semibold tracking-tight">
            {teamName}
          </CardTitle>
          <CardDescription className="text-white/55">
            {totalGoalEntries === 0
              ? "No detailed events"
              : `${goals.reduce((acc, e) => acc + e.count, 0) + ownGoals.reduce((acc, e) => acc + e.count, 0)} scored`}
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <Section title="Goals" empty={goals.length === 0 && ownGoals.length === 0}>
          {goals.map((event, idx) => (
            <PlayerLine key={`goal-${idx}`} event={event} />
          ))}
          {ownGoals.map((event, idx) => (
            <PlayerLine key={`og-${idx}`} event={event} suffix="OG" tone="warning" />
          ))}
        </Section>

        <Section title="Assists" empty={assists.length === 0}>
          {assists.map((event, idx) => (
            <PlayerLine key={`assist-${idx}`} event={event} />
          ))}
        </Section>

        <Section title="MOTM" empty={motm.length === 0}>
          {motm.map((event, idx) => (
            <PlayerLine key={`motm-${idx}`} event={event} />
          ))}
        </Section>

        <Section
          title="Cards"
          empty={yellows.length === 0 && reds.length === 0}
        >
          {yellows.map((event, idx) => (
            <PlayerLine key={`yc-${idx}`} event={event} suffix="YC" tone="warning" />
          ))}
          {reds.map((event, idx) => (
            <PlayerLine key={`rc-${idx}`} event={event} suffix="RC" tone="danger" />
          ))}
        </Section>
      </CardContent>
    </Card>
  );
}

function Section({
  title,
  empty,
  children,
}: {
  title: string;
  empty: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/55">
        {title}
      </p>
      {empty ? (
        <p className="text-xs text-white/35">—</p>
      ) : (
        <div className="flex flex-col gap-1">{children}</div>
      )}
    </div>
  );
}

function PlayerLine({
  event,
  suffix,
  tone = "default",
}: {
  event: MatchEvent;
  suffix?: string;
  tone?: "default" | "warning" | "danger";
}) {
  const toneClass =
    tone === "warning"
      ? "border-amber-300/30 bg-amber-400/10 text-amber-200"
      : tone === "danger"
        ? "border-rose-300/30 bg-rose-400/10 text-rose-200"
        : "border-white/15 bg-white/5 text-white/80";

  return (
    <div className="flex items-center gap-2 rounded-md border border-white/10 bg-[#02103f]/65 px-3 py-2">
      <p className="min-w-0 flex-1 truncate text-sm font-medium text-white">
        {event.player}
        {event.count > 1 ? (
          <span className="ml-1.5 text-xs font-semibold text-white/55">
            ×{event.count}
          </span>
        ) : null}
      </p>
      {event.reason ? (
        <span className="hidden truncate text-[10px] text-white/45 sm:inline">
          {event.reason}
        </span>
      ) : null}
      {suffix ? (
        <span
          className={`inline-flex shrink-0 items-center rounded-md border px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${toneClass}`}
        >
          {suffix}
        </span>
      ) : null}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-md border border-white/10 bg-[#02103f]/65 px-3 py-2">
      <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/55">
        {label}
      </span>
      <span className="truncate pl-3 text-right text-sm font-medium text-white">
        {value}
      </span>
    </div>
  );
}
