import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { TeamCrest } from "@/app/teams/team-crest";
import type { Team } from "@/app/teams/teams-data";
import { SiteNav } from "@/components/site-nav";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  effectiveRobloxPlayerId,
  extractRobloxUsername,
  getRobloxHeadshots,
  resolveRobloxUserIdsByUsernames,
} from "@/lib/roblox";
import {
  getAllRobloxMatchIds,
  getMatchRecordByRobloxId,
  getMatchTeamResolver,
  getSiteStatsBundle,
  loadMatchEventsForRobloxId,
} from "@/lib/site-db";
import { cn } from "@/lib/utils";

import { getEventsForMatch, type MatchEvent } from "../../match-events-data";
import type { MatchRecord } from "../../matches-data";

const matchSurfaceClass =
  "border-0 bg-white/[0.035] shadow-none ring-1 ring-white/[0.08] backdrop-blur-md";
const insetRowClass =
  "rounded-lg bg-white/[0.03] px-3 py-2 ring-1 ring-white/[0.06]";

type GetTeam = (slug: string | null, name: string) => Team;

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
  const ids = await getAllRobloxMatchIds();
  return ids.map((id) => ({ id }));
}

type MatchPageParams = { id: string };

export async function generateMetadata({
  params,
}: {
  params: Promise<MatchPageParams>;
}): Promise<Metadata> {
  const { id } = await params;
  const match = await getMatchRecordByRobloxId(id);
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
  const bundle = await getSiteStatsBundle();
  const match = bundle.matchesByRobloxId.get(id) ?? null;
  if (!match) notFound();

  const events =
    bundle.source === "supabase"
      ? ((await loadMatchEventsForRobloxId(id)) ?? [])
      : getEventsForMatch(id);

  const getTeam = getMatchTeamResolver(bundle.teams);
  const namesToResolve = [
    ...new Set(
      events
        .filter((e) => !e.robloxId)
        .map((e) => extractRobloxUsername(e.player))
        .filter((n): n is string => Boolean(n)),
    ),
  ];
  const resolvedByLowerUsername =
    await resolveRobloxUserIdsByUsernames(namesToResolve);
  const robloxIds = [
    ...new Set([
      ...events
        .map((e) => e.robloxId)
        .filter((id): id is string => Boolean(id)),
      ...resolvedByLowerUsername.values(),
    ]),
  ];
  const headshots = await getRobloxHeadshots(robloxIds);

  const home = getTeam(match.homeSlug, match.homeTeam);
  const away = getTeam(match.awaySlug, match.awayTeam);
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

        <MotmBanner
          match={match}
          events={events}
          headshots={headshots}
          resolvedByLowerUsername={resolvedByLowerUsername}
          getTeam={getTeam}
        />

        <section className="grid gap-4 lg:grid-cols-2">
          <TeamPanel
            match={match}
            events={events}
            side="home"
            headshots={headshots}
            resolvedByLowerUsername={resolvedByLowerUsername}
            getTeam={getTeam}
          />
          <TeamPanel
            match={match}
            events={events}
            side="away"
            headshots={headshots}
            resolvedByLowerUsername={resolvedByLowerUsername}
            getTeam={getTeam}
          />
        </section>

        <Card className={cn("gap-3 py-5", matchSurfaceClass)}>
          <CardHeader>
            <CardTitle className="text-base font-semibold text-white/90">
              Match Info
            </CardTitle>
            <CardDescription className="text-white/50">
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

function MotmBanner({
  match,
  events,
  headshots,
  resolvedByLowerUsername,
  getTeam,
}: {
  match: MatchRecord;
  events: MatchEvent[];
  headshots: Map<string, string>;
  resolvedByLowerUsername: Map<string, string>;
  getTeam: GetTeam;
}) {
  const motm = events.find((e) => e.type === "MOTM") ?? null;
  if (!motm) return null;

  const slug =
    motm.team === match.homeTeam
      ? match.homeSlug
      : motm.team === match.awayTeam
        ? match.awaySlug
        : null;
  const teamMeta = getTeam(slug, motm.team);

  const inner = (
    <div
      className={cn(
        "mx-auto flex max-w-lg items-center justify-center gap-4 rounded-xl px-5 py-4",
        matchSurfaceClass,
      )}
    >
      <TeamCrest team={teamMeta} size="sm" />
      <EventHeadshot
        robloxId={effectiveRobloxPlayerId(
          motm.robloxId,
          motm.player,
          resolvedByLowerUsername,
        )}
        name={motm.player}
        headshots={headshots}
        size="md"
      />
      <div className="min-w-0 flex-1 text-left">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/45">
          ⭐ Man of the match
        </p>
        <p className="truncate text-base font-semibold text-white/90">
          {motm.player}
        </p>
        <p className="truncate text-xs text-white/50">{motm.team}</p>
      </div>
    </div>
  );

  if (slug) {
    return (
      <Link
        href={`/teams/${slug}`}
        className="mx-auto block max-w-lg outline-none transition hover:opacity-[0.92] focus-visible:ring-2 focus-visible:ring-white/25"
        aria-label={`${motm.team} squad`}
      >
        {inner}
      </Link>
    );
  }

  return (
    <section aria-label="Man of the match" className="flex justify-center">
      {inner}
    </section>
  );
}

function EventHeadshot({
  robloxId,
  name,
  headshots,
  size = "sm",
}: {
  robloxId: string | null;
  name: string;
  headshots: Map<string, string>;
  size?: "sm" | "md";
}) {
  const url = robloxId ? headshots.get(robloxId) : undefined;
  const initials = name
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  const safeInitials = initials || "?";
  const dim = size === "md" ? "size-12" : "size-9";

  if (url) {
    return (
      <img
        src={url}
        alt=""
        className={cn(
          dim,
          "shrink-0 rounded-full object-cover ring-1 ring-white/15",
        )}
      />
    );
  }

  return (
    <div
      className={cn(
        dim,
        "flex shrink-0 items-center justify-center rounded-full bg-white/[0.07] text-[10px] font-semibold text-white/60 ring-1 ring-white/10 sm:text-xs",
      )}
      aria-hidden
    >
      {safeInitials}
    </div>
  );
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
  headshots,
  resolvedByLowerUsername,
  getTeam,
}: {
  match: MatchRecord;
  events: MatchEvent[];
  side: "home" | "away";
  headshots: Map<string, string>;
  resolvedByLowerUsername: Map<string, string>;
  getTeam: GetTeam;
}) {
  const teamName = side === "home" ? match.homeTeam : match.awayTeam;
  const slug = side === "home" ? match.homeSlug : match.awaySlug;
  const teamMeta = getTeam(slug, teamName);

  const teamEvents = events.filter((e) => e.team === teamName);
  const goals = teamEvents.filter((e) => e.type === "Goal");
  const ownGoals = teamEvents.filter((e) => e.type === "OG");
  const assists = teamEvents.filter((e) => e.type === "Assist");
  const yellows = teamEvents.filter((e) => e.type === "Yellow Card");
  const reds = teamEvents.filter((e) => e.type === "Red Card");

  const totalGoalEntries = goals.length + ownGoals.length;

  return (
    <Card className={cn("gap-3 py-5", matchSurfaceClass)}>
      <CardHeader className="flex flex-row items-center gap-3">
        <TeamCrest team={teamMeta} size="sm" />
        <div className="min-w-0">
          <CardTitle className="truncate text-lg font-semibold tracking-tight text-white/90">
            {teamName}
          </CardTitle>
          <CardDescription className="text-white/50">
            {totalGoalEntries === 0
              ? "No detailed events"
              : `${goals.reduce((acc, e) => acc + e.count, 0) + ownGoals.reduce((acc, e) => acc + e.count, 0)} scored`}
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <Section
          title="⚽ Goals"
          empty={goals.length === 0 && ownGoals.length === 0}
        >
          {goals.map((event, idx) => (
            <PlayerLine
              key={`goal-${idx}`}
              event={event}
              headshots={headshots}
              resolvedByLowerUsername={resolvedByLowerUsername}
              rowEmoji="⚽"
            />
          ))}
          {ownGoals.map((event, idx) => (
            <PlayerLine
              key={`og-${idx}`}
              event={event}
              headshots={headshots}
              resolvedByLowerUsername={resolvedByLowerUsername}
              rowEmoji="⚽"
              suffix="OG"
              tone="warning"
            />
          ))}
        </Section>

        <Section title="🅰️ Assists" empty={assists.length === 0}>
          {assists.map((event, idx) => (
            <PlayerLine
              key={`assist-${idx}`}
              event={event}
              headshots={headshots}
              resolvedByLowerUsername={resolvedByLowerUsername}
              rowEmoji="🅰️"
            />
          ))}
        </Section>

        <Section
          title="Cards"
          empty={yellows.length === 0 && reds.length === 0}
        >
          {yellows.map((event, idx) => (
            <PlayerLine
              key={`yc-${idx}`}
              event={event}
              headshots={headshots}
              resolvedByLowerUsername={resolvedByLowerUsername}
              suffix="YC"
              tone="warning"
            />
          ))}
          {reds.map((event, idx) => (
            <PlayerLine
              key={`rc-${idx}`}
              event={event}
              headshots={headshots}
              resolvedByLowerUsername={resolvedByLowerUsername}
              suffix="RC"
              tone="danger"
            />
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
      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/45">
        {title}
      </p>
      {empty ? (
        <p className="text-xs text-white/35">—</p>
      ) : (
        <div className="flex flex-col gap-1.5">{children}</div>
      )}
    </div>
  );
}

function PlayerLine({
  event,
  headshots,
  resolvedByLowerUsername,
  rowEmoji,
  suffix,
  tone = "default",
}: {
  event: MatchEvent;
  headshots: Map<string, string>;
  resolvedByLowerUsername: Map<string, string>;
  rowEmoji?: string;
  suffix?: string;
  tone?: "default" | "warning" | "danger";
}) {
  const toneClass =
    tone === "warning"
      ? "border-amber-400/20 bg-amber-400/[0.08] text-amber-100/90"
      : tone === "danger"
        ? "border-rose-400/20 bg-rose-400/[0.08] text-rose-100/90"
        : "border-white/10 bg-white/[0.04] text-white/75";

  return (
    <div
      className={cn(
        "flex items-center gap-2.5 rounded-lg px-2.5 py-2 ring-1 ring-white/[0.06]",
        tone === "default"
          ? "bg-white/[0.03]"
          : tone === "warning"
            ? "bg-amber-400/[0.04]"
            : "bg-rose-400/[0.04]",
      )}
    >
      {rowEmoji ? (
        <span className="shrink-0 text-sm leading-none opacity-85" aria-hidden>
          {rowEmoji}
        </span>
      ) : null}
      <EventHeadshot
        robloxId={effectiveRobloxPlayerId(
          event.robloxId,
          event.player,
          resolvedByLowerUsername,
        )}
        name={event.player}
        headshots={headshots}
        size="sm"
      />
      <p className="min-w-0 flex-1 truncate text-sm font-medium text-white/88">
        {event.player}
        {event.count > 1 ? (
          <span className="ml-1.5 text-xs font-semibold text-white/45">
            ×{event.count}
          </span>
        ) : null}
      </p>
      {event.reason ? (
        <span className="hidden max-w-[40%] truncate text-[10px] text-white/40 sm:inline">
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
