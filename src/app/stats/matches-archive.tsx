import Link from "next/link";

import type { Team } from "@/app/teams/teams-data";
import { TeamCrest } from "@/app/teams/team-crest";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  getMatchTeamResolver,
  getSiteStatsBundle,
} from "@/lib/site-db";

import type { FixtureRow } from "./fixtures-data";
import type { MatchRecord } from "./matches-data";

type GetTeam = (slug: string | null, name: string) => Team;

const DATE_FORMATTER = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

function formatDate(value: string): string {
  const date = new Date(`${value}T12:00:00Z`);
  if (Number.isNaN(date.getTime())) return value;
  return DATE_FORMATTER.format(date);
}

export async function MatchesArchive() {
  const bundle = await getSiteStatsBundle();
  const getTeam = getMatchTeamResolver(bundle.teams);
  return (
    <>
      <section className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.32em] text-white/55">
            League data
          </p>
          <h1 className="mt-2 text-4xl font-semibold tracking-tight sm:text-5xl">
            All matches
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-white/70 sm:text-base">
            Every fixture from the league archive. Played matches show full
            data and link to the match report; missing fixtures are tagged No
            Data.
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Badge
            variant="outline"
            className="border-white/15 bg-white/5 text-white/85"
          >
            {bundle.fixtureCounts.total} fixtures
          </Badge>
          <Badge
            variant="outline"
            className="border-emerald-300/30 bg-emerald-400/10 text-emerald-200"
          >
            {bundle.fixtureCounts.played} played
          </Badge>
          <Badge
            variant="outline"
            className="border-white/10 bg-white/5 text-white/55"
          >
            {bundle.fixtureCounts.missing} no data
          </Badge>
        </div>
      </section>

      <section className="flex flex-col gap-8">
        {bundle.fixtureGroups.map((group) => {
          const playedInGroup = group.rows.filter((r) => r.match !== null)
            .length;
          return (
            <div key={group.key} className="flex flex-col gap-3">
              <div className="flex flex-wrap items-end justify-between gap-2 px-1">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.32em] text-white/55">
                    Season {group.season}
                  </p>
                  <h2 className="mt-1 text-lg font-semibold tracking-tight sm:text-xl">
                    {group.competition}
                  </h2>
                </div>
                <span className="text-[11px] font-medium text-white/55">
                  {playedInGroup} of {group.rows.length} played
                </span>
              </div>
              <div className="flex flex-col gap-2">
                {group.rows.map((row) =>
                  row.match ? (
                    <PlayedRow
                      key={row.match.id}
                      match={row.match}
                      getTeam={getTeam}
                    />
                  ) : (
                    <MissingRow key={row.id} row={row} getTeam={getTeam} />
                  ),
                )}
              </div>
            </div>
          );
        })}
      </section>
    </>
  );
}

function PlayedRow({
  match,
  getTeam,
}: {
  match: MatchRecord;
  getTeam: GetTeam;
}) {
  const home = getTeam(match.homeSlug, match.homeTeam);
  const away = getTeam(match.awaySlug, match.awayTeam);
  const isFFT = match.fft !== "No";
  const homeWon = match.homeScore > match.awayScore;
  const awayWon = match.awayScore > match.homeScore;

  return (
    <Link
      href={`/stats/matches/${match.id}`}
      className="block rounded-xl outline-none transition focus-visible:ring-2 focus-visible:ring-white/40"
    >
      <Card className="gap-0 py-0 transition hover:bg-white/[0.07] hover:ring-white/25">
        <CardContent className="grid grid-cols-[auto_1fr_auto] items-center gap-3 px-3 py-3 sm:grid-cols-[110px_1fr_auto] sm:gap-4 sm:px-4 sm:py-3.5">
          <div className="flex flex-col gap-1">
            <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/55">
              {formatDate(match.date)}
            </span>
            <span className="text-[10px] uppercase tracking-[0.18em] text-white/40">
              S{match.season} · {match.gameWeek}
            </span>
          </div>

          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 sm:gap-4">
            <TeamLine team={home} name={match.homeTeam} align="end" />
            <div className="flex flex-col items-center gap-0.5">
              <div className="flex items-center gap-1.5 text-lg font-bold tabular-nums text-white sm:text-xl">
                <span className={homeWon ? "" : "text-white/65"}>
                  {match.homeScore}
                </span>
                <span className="text-white/35">–</span>
                <span className={awayWon ? "" : "text-white/65"}>
                  {match.awayScore}
                </span>
              </div>
              {match.stage !== "Group" ? (
                <span className="text-[9px] font-semibold uppercase tracking-[0.18em] text-white/45">
                  {match.stage}
                </span>
              ) : null}
            </div>
            <TeamLine team={away} name={match.awayTeam} align="start" />
          </div>

          <div className="flex shrink-0 flex-col items-end gap-1">
            <Badge
              variant="outline"
              className="border-white/15 px-2 py-0 text-[10px] text-white/70"
            >
              {abbreviate(match.competition)}
            </Badge>
            {isFFT ? (
              <Badge
                variant="outline"
                className="border-amber-300/30 bg-amber-400/10 px-2 py-0 text-[10px] text-amber-200"
              >
                {match.fft === "Mercy"
                  ? "Mercy"
                  : match.fft === "Partial"
                    ? "Partial FFT"
                    : "FFT"}
              </Badge>
            ) : null}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

function MissingRow({
  row,
  getTeam,
}: {
  row: FixtureRow;
  getTeam: GetTeam;
}) {
  const teamA = row.teamA ? getTeam(null, row.teamA) : null;
  const teamB = row.teamB ? getTeam(null, row.teamB) : null;
  const isKnockoutSlot = !teamA && !teamB;

  return (
    <Card className="gap-0 py-0 opacity-60 grayscale">
      <CardContent className="grid grid-cols-[auto_1fr_auto] items-center gap-3 px-3 py-3 sm:grid-cols-[110px_1fr_auto] sm:gap-4 sm:px-4 sm:py-3.5">
        <div className="flex flex-col gap-1">
          <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/40">
            —
          </span>
          <span className="text-[10px] uppercase tracking-[0.18em] text-white/35">
            S{row.season} · {row.id}
          </span>
        </div>

        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 sm:gap-4">
          {teamA ? (
            <TeamLine team={teamA} name={row.teamA} align="end" muted />
          ) : (
            <span className="justify-self-end text-right text-xs uppercase tracking-[0.2em] text-white/35">
              {isKnockoutSlot ? "TBD" : ""}
            </span>
          )}
          <div className="flex items-center gap-1.5 text-lg font-bold tabular-nums text-white/30 sm:text-xl">
            <span>—</span>
            <span className="text-white/20">–</span>
            <span>—</span>
          </div>
          {teamB ? (
            <TeamLine team={teamB} name={row.teamB} align="start" muted />
          ) : (
            <span className="justify-self-start text-left text-xs uppercase tracking-[0.2em] text-white/35">
              {isKnockoutSlot ? "TBD" : ""}
            </span>
          )}
        </div>

        <div className="flex shrink-0 flex-col items-end gap-1">
          <Badge
            variant="outline"
            className="border-white/15 px-2 py-0 text-[10px] text-white/55"
          >
            {abbreviate(row.competition)}
          </Badge>
          <Badge
            variant="outline"
            className="border-white/10 bg-white/5 px-2 py-0 text-[10px] uppercase tracking-wider text-white/55"
          >
            No Data
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
}

function TeamLine({
  team,
  name,
  align,
  muted = false,
}: {
  team: Team;
  name: string;
  align: "start" | "end";
  muted?: boolean;
}) {
  const nameClass = `hidden truncate text-sm font-semibold sm:inline ${
    muted ? "text-white/55" : "text-white"
  }`;
  return (
    <div
      className={`flex min-w-0 items-center gap-2 ${
        align === "end" ? "justify-end text-right" : "justify-start text-left"
      }`}
    >
      {align === "end" ? (
        <>
          <span className={nameClass}>{name}</span>
          <TeamCrest team={team} size="sm" />
        </>
      ) : (
        <>
          <TeamCrest team={team} size="sm" />
          <span className={nameClass}>{name}</span>
        </>
      )}
    </div>
  );
}

function abbreviate(competition: string): string {
  switch (competition) {
    case "EuroLeague":
      return "EL";
    case "EuroBlox Playoffs":
      return "Playoffs";
    case "British Premier":
      return "BP";
    case "Serie Italia":
      return "SI";
    default:
      return competition;
  }
}
