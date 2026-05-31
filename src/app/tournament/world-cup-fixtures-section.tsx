import Link from "next/link";

import { TeamCrest } from "@/app/teams/team-crest";
import type { Team } from "@/app/teams/teams-data";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  S3_WORLD_CUP_GROUP_FIXTURES,
  type S3WorldCupGroupFixture,
} from "@/lib/s3-world-cup-group-schedule";

const DATE_FORMATTER = new Intl.DateTimeFormat("en-GB", {
  weekday: "short",
  day: "2-digit",
  month: "short",
  year: "numeric",
});

const TIME_FORMATTER = new Intl.DateTimeFormat("en-GB", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "UTC",
  timeZoneName: "short",
});

function formatKickoff(iso: string): { date: string; time: string } {
  const d = new Date(iso);
  return {
    date: DATE_FORMATTER.format(d),
    time: TIME_FORMATTER.format(d),
  };
}

function FixtureCard({
  fx,
  teamBySlug,
}: {
  fx: S3WorldCupGroupFixture;
  teamBySlug: Map<string, Team>;
}) {
  const home = teamBySlug.get(fx.homeSlug);
  const away = teamBySlug.get(fx.awaySlug);
  const kickoff = formatKickoff(fx.scheduledAt);

  return (
    <Card className="gap-0 border-white/10 bg-white/[0.03] py-0 transition hover:bg-white/[0.05]">
      <CardContent className="grid grid-cols-[auto_1fr_auto] items-center gap-3 px-3 py-3 sm:grid-cols-[130px_1fr_auto] sm:gap-4 sm:px-4 sm:py-3.5">
        <div className="flex flex-col gap-1">
          <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/60">
            {kickoff.date}
          </span>
          <span className="text-[10px] font-medium tabular-nums tracking-[0.08em] text-white/45">
            {kickoff.time}
          </span>
          <span className="text-[10px] uppercase tracking-[0.18em] text-white/40">
            {fx.gameWeekLabel} · G{fx.group}
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
          <span className="text-[9px] uppercase tracking-[0.16em] text-white/35">
            {fx.fixtureCode}
          </span>
        </div>
      </CardContent>
    </Card>
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

const GW_LABELS: Record<1 | 2 | 3, string> = {
  1: "5–7 Jun · opening weekend",
  2: "13–14 Jun · weekend",
  3: "20–21 Jun · weekend",
};

export function WorldCupFixturesSection({
  teamBySlug,
}: {
  teamBySlug: Map<string, Team>;
}) {
  const byGw = ([1, 2, 3] as const).map((gw) => ({
    gw,
    fixtures: S3_WORLD_CUP_GROUP_FIXTURES.filter((f) => f.gameWeek === gw),
  }));

  return (
    <section className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.32em] text-white/55">
            Group stage
          </p>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">
            Fixtures
          </h2>
          <p className="mt-2 max-w-xl text-sm leading-6 text-white/65">
            GW1–GW3 · randomized draw · all kickoffs UTC · stadium TBD until
            venues are confirmed.
          </p>
        </div>
        <Badge
          variant="outline"
          className="h-8 shrink-0 gap-2 border-white/15 bg-white/5 px-3 text-white/85"
        >
          <span className="h-1.5 w-1.5 rounded-full bg-sky-400 shadow-[0_0_10px_rgba(56,189,248,0.9)]" />
          {S3_WORLD_CUP_GROUP_FIXTURES.length} group matches
        </Badge>
      </div>

      <div className="flex flex-col gap-8">
        {byGw.map(({ gw, fixtures }) => (
          <div key={gw} className="flex flex-col gap-3">
            <div className="flex flex-wrap items-end justify-between gap-2 px-1">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.32em] text-white/55">
                  Gameweek {gw}
                </p>
                <h3 className="mt-1 text-lg font-semibold tracking-tight text-white">
                  {GW_LABELS[gw]}
                </h3>
              </div>
              <span className="text-[11px] font-medium text-white/55">
                {fixtures.length} fixtures
              </span>
            </div>
            <div className="flex flex-col gap-2">
              {fixtures.map((fx) => (
                <FixtureCard key={fx.fixtureCode} fx={fx} teamBySlug={teamBySlug} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
