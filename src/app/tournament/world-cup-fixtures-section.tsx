import Link from "next/link";
import type { ReactNode } from "react";

import type { MatchRecord } from "@/app/stats/matches-data";
import { FixtureKickoffTime } from "@/components/fixture-kickoff-time";
import { TeamCrest } from "@/app/teams/team-crest";
import type { Team } from "@/app/teams/teams-data";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { fixtureCodeMatchHref } from "@/lib/match-page-context";
import { S3_WORLD_CUP_KNOCKOUT_CALENDAR } from "@/lib/s3-world-cup-calendar";
import type { S3WorldCupMatchday } from "@/lib/s3-world-cup-calendar";
import {
  S3_WORLD_CUP_GROUP_FIXTURES,
  type S3WorldCupGroupFixture,
} from "@/lib/s3-world-cup-group-schedule";
import {
  S3_WORLD_CUP_KNOCKOUT_FIXTURES,
  type S3WorldCupKnockoutFixture,
} from "@/lib/s3-world-cup-knockout-schedule";
import { compareScheduledAtNewestFirst } from "@/lib/fixture-sort";
import { formatWcKickoff } from "@/lib/wc-fixture-kickoff";
import { cn } from "@/lib/utils";

function kickoffIsoForFixture(
  fixtureCode: string,
  staticScheduledAt: string,
  matchesByRobloxId: Map<string, MatchRecord>,
): string {
  return (
    matchesByRobloxId.get(fixtureCode)?.scheduledAt?.trim() || staticScheduledAt
  );
}

function kickoffDateLabel(iso: string): string {
  return formatWcKickoff(iso).date;
}

function FixtureMatchLink({
  href,
  children,
}: {
  href: string | null;
  children: ReactNode;
}) {
  if (!href) return <>{children}</>;
  return (
    <Link
      href={href}
      className="block rounded-xl outline-none transition focus-visible:ring-2 focus-visible:ring-white/40"
    >
      {children}
    </Link>
  );
}

function GroupFixtureCard({
  fx,
  teamBySlug,
  matchHref,
  matchesByRobloxId,
}: {
  fx: S3WorldCupGroupFixture;
  teamBySlug: Map<string, Team>;
  matchHref: string | null;
  matchesByRobloxId: Map<string, MatchRecord>;
}) {
  const home = teamBySlug.get(fx.homeSlug);
  const away = teamBySlug.get(fx.awaySlug);
  const kickoffIso = kickoffIsoForFixture(
    fx.fixtureCode,
    fx.scheduledAt,
    matchesByRobloxId,
  );
  const kickoffDate = kickoffDateLabel(kickoffIso);

  return (
    <FixtureMatchLink href={matchHref}>
      <Card
        className={cn(
          "gap-0 border-white/10 bg-white/[0.03] py-0 transition",
          matchHref
            ? "cursor-pointer hover:border-sky-300/30 hover:bg-sky-400/[0.06] hover:ring-1 hover:ring-sky-300/20"
            : "hover:bg-white/[0.05]",
        )}
      >
      <CardContent className="grid grid-cols-[auto_1fr_auto] items-center gap-3 px-3 py-3 sm:grid-cols-[minmax(148px,168px)_1fr_auto] sm:gap-4 sm:px-4 sm:py-3.5">
        <div className="flex flex-col gap-1">
          <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/60">
            {kickoffDate}
          </span>
          <span className="max-w-[168px] text-[10px] font-medium leading-snug tracking-[0.04em] text-white/45">
            <FixtureKickoffTime iso={kickoffIso} />
          </span>
        </div>

        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 sm:gap-4">
          {home ? (
            <TeamFixtureLine team={home} name={fx.homeTeamName} align="end" />
          ) : (
            <span className="justify-self-end text-sm font-semibold text-white">
              {fx.homeTeamName}
            </span>
          )}
          <span className="text-sm font-semibold text-white/35">vs</span>
          {away ? (
            <TeamFixtureLine team={away} name={fx.awayTeamName} align="start" />
          ) : (
            <span className="justify-self-start text-sm font-semibold text-white">
              {fx.awayTeamName}
            </span>
          )}
        </div>

        <div className="flex shrink-0 flex-col items-end gap-1">
          <Badge
            variant="outline"
            className="border-white/15 px-2 py-0 text-[10px] text-white/65"
          >
            {fx.stadium}
          </Badge>
        </div>
      </CardContent>
    </Card>
    </FixtureMatchLink>
  );
}

function KnockoutFixtureCard({
  fx,
  matchHref,
  matchesByRobloxId,
}: {
  fx: S3WorldCupKnockoutFixture;
  matchHref: string | null;
  matchesByRobloxId: Map<string, MatchRecord>;
}) {
  const kickoffIso = kickoffIsoForFixture(
    fx.fixtureCode,
    fx.scheduledAt,
    matchesByRobloxId,
  );

  return (
    <FixtureMatchLink href={matchHref}>
      <Card
        className={cn(
          "gap-0 border-white/10 bg-white/[0.03] py-0 transition",
          matchHref
            ? "cursor-pointer hover:border-sky-300/30 hover:bg-sky-400/[0.06] hover:ring-1 hover:ring-sky-300/20"
            : undefined,
        )}
      >
      <CardContent className="grid grid-cols-[auto_1fr_auto] items-center gap-3 px-3 py-3 sm:grid-cols-[minmax(148px,168px)_1fr_auto] sm:gap-4 sm:px-4 sm:py-3.5">
        <div className="flex flex-col gap-1">
          <span className="max-w-[168px] text-[10px] font-medium leading-snug tracking-[0.04em] text-white/50">
            <FixtureKickoffTime iso={kickoffIso} />
          </span>
          <span className="text-[10px] uppercase tracking-[0.18em] text-white/40">
            {fx.shortCode}
          </span>
        </div>

        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 sm:gap-4">
          <span className="justify-self-end text-right text-sm font-semibold text-white/75">
            {fx.homeLabel}
          </span>
          <span className="text-sm font-semibold text-white/35">vs</span>
          <span className="justify-self-start text-left text-sm font-semibold text-white/75">
            {fx.awayLabel}
          </span>
        </div>

        <Badge
          variant="outline"
          className="h-6 shrink-0 border-white/15 px-2 text-[10px] text-white/65"
        >
          {fx.stadium}
        </Badge>
      </CardContent>
    </Card>
    </FixtureMatchLink>
  );
}

function TeamFixtureLine({
  team,
  name,
  align,
}: {
  team: Team;
  name: string;
  align: "start" | "end";
}) {
  return (
    <Link
      href={`/teams/${team.slug}`}
      className={`flex min-w-0 items-center gap-2 outline-none transition hover:opacity-90 focus-visible:ring-2 focus-visible:ring-white/40 ${
        align === "end" ? "justify-end text-right" : "justify-start text-left"
      }`}
    >
      {align === "end" ? (
        <>
          <span className="hidden truncate text-sm font-semibold sm:inline">
            {name}
          </span>
          <TeamCrest team={team} size="sm" />
        </>
      ) : (
        <>
          <TeamCrest team={team} size="sm" />
          <span className="hidden truncate text-sm font-semibold sm:inline">
            {name}
          </span>
        </>
      )}
    </Link>
  );
}

const MATCHDAY_META: Record<
  S3WorldCupMatchday,
  { title: string; dates: string; note?: string }
> = {
  1: { title: "Matchday 1", dates: "5–7 June" },
  2: { title: "Matchday 2", dates: "10–12 June" },
  3: {
    title: "Matchday 3",
    dates: "15–17 June",
    note: "Final group matches kick off simultaneously",
  },
};

function formatCalendarHeading(date: string): string {
  const d = new Date(`${date}T12:00:00+01:00`);
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
    timeZone: "Europe/London",
  }).format(d);
}

const KO_SECTIONS = [
  { key: "r16", title: "Round of 16", symbol: "◈", days: S3_WORLD_CUP_KNOCKOUT_CALENDAR.r16 },
  { key: "qf", title: "Quarter-Finals", symbol: "◆", days: S3_WORLD_CUP_KNOCKOUT_CALENDAR.qf },
  { key: "sf", title: "Semi-Finals", symbol: "▲", days: S3_WORLD_CUP_KNOCKOUT_CALENDAR.sf },
  { key: "final", title: "Final", symbol: "★", days: S3_WORLD_CUP_KNOCKOUT_CALENDAR.final },
] as const;

const koByCode = new Map(
  S3_WORLD_CUP_KNOCKOUT_FIXTURES.map((f) => [f.fixtureCode, f]),
);

export function WorldCupFixturesSection({
  teamBySlug,
  matchesByRobloxId,
}: {
  teamBySlug: Map<string, Team>;
  matchesByRobloxId: Map<string, MatchRecord>;
}) {
  const hrefFor = (fixtureCode: string) =>
    fixtureCodeMatchHref(fixtureCode, matchesByRobloxId);
  const byMatchday = ([3, 2, 1] as const).map((md) => ({
    md,
    meta: MATCHDAY_META[md],
    fixtures: S3_WORLD_CUP_GROUP_FIXTURES.filter((f) => f.matchday === md).sort(
      (a, b) =>
        compareScheduledAtNewestFirst(
          kickoffIsoForFixture(a.fixtureCode, a.scheduledAt, matchesByRobloxId),
          kickoffIsoForFixture(b.fixtureCode, b.scheduledAt, matchesByRobloxId),
        ),
    ),
  }));

  return (
    <section className="flex flex-col gap-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.32em] text-white/55">
            Group stage
          </p>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">
            Fixtures
          </h2>
          <p className="mt-2 max-w-xl text-sm leading-6 text-white/65">
            Three matchdays · kickoffs 6–10 pm BST · stadium TBD.
          </p>
        </div>
        <Badge
          variant="outline"
          className="h-8 shrink-0 gap-2 border-white/15 bg-white/5 px-3 text-white/85"
        >
          <span className="h-1.5 w-1.5 rounded-full bg-sky-400 shadow-[0_0_10px_rgba(56,189,248,0.9)]" />
          {S3_WORLD_CUP_GROUP_FIXTURES.length + S3_WORLD_CUP_KNOCKOUT_FIXTURES.length}{" "}
          fixtures
        </Badge>
      </div>

      <div className="flex flex-col gap-8">
        {byMatchday.map(({ md, meta, fixtures }) => (
          <div key={md} className="flex flex-col gap-3">
            <div className="flex flex-wrap items-end justify-between gap-2 px-1">
              <div>
                <h3 className="text-lg font-semibold tracking-tight text-white">
                  {meta.title}
                </h3>
                <p className="mt-1 text-sm text-white/55">{meta.dates}</p>
                {meta.note ? (
                  <p className="mt-1 text-[11px] text-white/45">{meta.note}</p>
                ) : null}
              </div>
              <span className="text-[11px] font-medium text-white/55">
                {fixtures.length} fixtures
              </span>
            </div>
            <div className="flex flex-col gap-2">
              {fixtures.map((fx) => (
                <GroupFixtureCard
                  key={fx.fixtureCode}
                  fx={fx}
                  teamBySlug={teamBySlug}
                  matchHref={hrefFor(fx.fixtureCode)}
                  matchesByRobloxId={matchesByRobloxId}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      {[...KO_SECTIONS].reverse().map((section) => (
        <div key={section.key} className="flex flex-col gap-5">
          <h3 className="flex items-center gap-2 text-lg font-semibold tracking-tight text-white">
            <span className="text-white/45">{section.symbol}</span>
            {section.title}
          </h3>
          {[...section.days].reverse().map((day) => (
            <div key={day.date} className="flex flex-col gap-3">
              <div className="px-1">
                <p className="text-[10px] font-semibold uppercase tracking-[0.32em] text-white/55">
                  {formatCalendarHeading(day.date).toUpperCase()}
                </p>
                <h4 className="mt-1 text-base font-semibold tracking-tight text-white">
                  {day.dayLabel}
                </h4>
              </div>
              <div className="flex flex-col gap-2">
                {[...day.fixtureCodes].reverse().map((code) => {
                  const fx = koByCode.get(code);
                  if (!fx) return null;
                  return (
                    <KnockoutFixtureCard
                      key={code}
                      fx={fx}
                      matchHref={hrefFor(code)}
                      matchesByRobloxId={matchesByRobloxId}
                    />
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      ))}
    </section>
  );
}
