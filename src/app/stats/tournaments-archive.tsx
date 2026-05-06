import { Trophy } from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import type { MatchRecord } from "@/app/stats/matches-data";
import { getSiteStatsBundle } from "@/lib/site-db";
import {
  buildKnockoutRounds,
  competitionKeysWithResults,
  computeGroupStandings,
  getCompetitionChampion,
  type CompetitionChampion,
  type StandingRow,
} from "@/lib/stats-tournaments";

const SEASON_INTRO: Record<number, string> = {
  1: "EuroLeague table plus the EuroBlox Playoffs knockout — bird’s-eye view.",
  2: "British Premier and Serie Italia — league tables only (round robin).",
  3: "World Cup — group mini-tables and the knockout path when results are in.",
};

function abbrevCompetition(competition: string): string {
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
      return competition.length > 16
        ? `${competition.slice(0, 14)}…`
        : competition;
  }
}

function groupCompetitionsBySeason(
  pairs: { season: number; competition: string }[],
): Map<number, string[]> {
  const map = new Map<number, string[]>();
  for (const { season, competition } of pairs) {
    if (!map.has(season)) map.set(season, []);
    map.get(season)!.push(competition);
  }
  for (const [, list] of map) {
    list.sort((a, b) => a.localeCompare(b));
  }
  return map;
}

export async function TournamentsArchive() {
  const bundle = await getSiteStatsBundle();
  const pairs = competitionKeysWithResults(bundle.allMatches);
  const bySeason = groupCompetitionsBySeason(pairs);
  const seasonsToShow = [1, 2, 3].filter((s) => (bySeason.get(s)?.length ?? 0) > 0);

  return (
    <>
      <section className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.32em] text-white/55">
            League data
          </p>
          <h1 className="mt-2 text-4xl font-semibold tracking-tight sm:text-5xl">
            Tournaments
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-white/70 sm:text-base">
            Season structure at a glance: league tables where they exist and
            knockout rails for cups and the World Cup — compact layout so you
            can scan how each campaign played out.
          </p>
        </div>
        <Badge
          variant="outline"
          className="border-white/15 bg-white/5 text-white/80"
        >
          {pairs.length} competition
          {pairs.length === 1 ? "" : "s"} ·{" "}
          {bundle.fixtureCounts.played} results
        </Badge>
      </section>

      {seasonsToShow.length === 0 ? (
        <p className="text-sm text-white/55">
          No competition results in the archive yet.
        </p>
      ) : (
        <div className="flex flex-col gap-12">
          {seasonsToShow.map((season) => (
            <section key={season} className="flex flex-col gap-6">
              <div className="border-b border-white/10 pb-3">
                <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">
                  Season {season}
                </h2>
                <p className="mt-1 max-w-3xl text-xs leading-relaxed text-white/55 sm:text-sm">
                  {SEASON_INTRO[season] ??
                    "Tables and knockout stages from recorded matches."}
                </p>
              </div>

              <div className="flex flex-col gap-6">
                {(bySeason.get(season) ?? []).map((competition) => (
                  <CompetitionBlock
                    key={`${season}-${competition}`}
                    season={season}
                    competition={competition}
                    allMatches={bundle.allMatches}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </>
  );
}

function CompetitionBlock({
  season,
  competition,
  allMatches,
}: {
  season: number;
  competition: string;
  allMatches: MatchRecord[];
}) {
  const standings = computeGroupStandings(allMatches, season, competition);
  const rounds = buildKnockoutRounds(allMatches, season, competition);

  if (standings.length === 0 && rounds.length === 0) return null;

  const champion = getCompetitionChampion(standings, rounds);

  return (
    <Card className="gap-0 border-white/10 bg-white/[0.03] py-0">
      <CardHeader className="border-b border-white/10 px-4 py-3 sm:px-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-base font-semibold text-white sm:text-lg">
            {competition}
          </h3>
          <Badge
            variant="outline"
            className="border-white/15 text-[10px] text-white/65"
          >
            S{season} · {abbrevCompetition(competition)}
          </Badge>
        </div>
      </CardHeader>

      {champion ? <ChampionStrip champion={champion} /> : null}

      <CardContent className="flex flex-col gap-5 px-3 py-4 sm:px-5">
        {standings.length > 0 ? (
          <div>
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-white/45">
              Table
            </p>
            <StandingsMini
              rows={standings}
              championTeam={
                champion?.source === "league" ? champion.team : null
              }
            />
          </div>
        ) : null}
        {rounds.length > 0 ? (
          <div>
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-white/45">
              Knockout
            </p>
            <KnockoutOverview rounds={rounds} />
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function ChampionStrip({ champion }: { champion: CompetitionChampion }) {
  const label =
    champion.source === "knockout" ? "Cup Champions" : "League Champions";
  const TeamTag = champion.slug ? (
    <Link
      href={`/teams/${encodeURIComponent(champion.slug)}`}
      className="truncate text-base font-bold text-white underline decoration-amber-200/45 underline-offset-4 transition hover:decoration-amber-200/90 sm:text-lg"
    >
      {champion.team}
    </Link>
  ) : (
    <span className="truncate text-base font-bold text-white sm:text-lg">
      {champion.team}
    </span>
  );

  return (
    <div className="border-b border-amber-300/25 bg-gradient-to-r from-amber-300/15 via-amber-300/10 to-transparent px-4 py-2.5 sm:px-5">
      <div className="flex items-center gap-3">
        <div
          className="flex size-8 shrink-0 items-center justify-center rounded-full bg-amber-300/20 text-amber-100 ring-1 ring-amber-200/35"
          aria-hidden
        >
          <Trophy className="size-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[9px] font-semibold uppercase tracking-[0.28em] text-amber-200/85 sm:text-[10px]">
            {label}
          </p>
          <div className="mt-0.5 truncate">{TeamTag}</div>
        </div>
      </div>
    </div>
  );
}

function StandingsMini({
  rows,
  championTeam,
}: {
  rows: StandingRow[];
  /** When set, that team's row gets the gold-row treatment. */
  championTeam: string | null;
}) {
  return (
    <div className="overflow-x-auto rounded-lg border border-white/10 bg-black/20">
      <table className="w-full min-w-[420px] border-collapse text-[10px] sm:text-xs">
        <thead>
          <tr className="border-b border-white/10 text-left text-[9px] font-semibold uppercase tracking-wider text-white/45 sm:text-[10px]">
            <th className="px-2 py-1.5 sm:px-3 sm:py-2">#</th>
            <th className="px-2 py-1.5 sm:px-3 sm:py-2">Team</th>
            <th className="px-1 py-1.5 tabular-nums sm:py-2">P</th>
            <th className="px-1 py-1.5 tabular-nums sm:py-2">W</th>
            <th className="px-1 py-1.5 tabular-nums sm:py-2">D</th>
            <th className="px-1 py-1.5 tabular-nums sm:py-2">L</th>
            <th className="px-1 py-1.5 tabular-nums sm:py-2">GF</th>
            <th className="px-1 py-1.5 tabular-nums sm:py-2">GA</th>
            <th className="px-1 py-1.5 tabular-nums sm:py-2">GD</th>
            <th className="px-2 py-1.5 font-bold tabular-nums sm:py-2">Pts</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const isChampion = championTeam != null && r.team === championTeam;
            const numCellClass = isChampion
              ? "px-1 py-1 tabular-nums text-amber-100 sm:py-1.5"
              : "px-1 py-1 tabular-nums text-white/75 sm:py-1.5";
            return (
              <tr
                key={r.team}
                className={`border-b border-white/5 last:border-0 ${
                  isChampion
                    ? "bg-amber-300/[0.07] hover:bg-amber-300/[0.12]"
                    : "hover:bg-white/[0.04]"
                }`}
                title={isChampion ? "Champions" : undefined}
              >
                <td
                  className={`px-2 py-1 tabular-nums sm:px-3 sm:py-1.5 ${
                    isChampion ? "text-amber-200" : "text-white/50"
                  }`}
                >
                  <span className="inline-flex items-center gap-1">
                    {isChampion ? (
                      <Trophy
                        className="size-3 text-amber-200"
                        aria-label="Champions"
                      />
                    ) : null}
                    {i + 1}
                  </span>
                </td>
                <td className="max-w-[140px] px-2 py-1 sm:max-w-[200px] sm:px-3 sm:py-1.5">
                  {r.slug ? (
                    <Link
                      href={`/teams/${encodeURIComponent(r.slug)}`}
                      className={`truncate font-medium underline underline-offset-2 ${
                        isChampion
                          ? "text-white decoration-amber-200/45 hover:decoration-amber-200/90"
                          : "text-white decoration-white/25 hover:decoration-white/60"
                      } ${isChampion ? "font-bold" : ""}`}
                    >
                      {r.team}
                    </Link>
                  ) : (
                    <span
                      className={`truncate font-medium ${
                        isChampion ? "font-bold text-white" : "text-white/90"
                      }`}
                    >
                      {r.team}
                    </span>
                  )}
                </td>
                <td className={numCellClass}>{r.played}</td>
                <td className={numCellClass}>{r.won}</td>
                <td className={numCellClass}>{r.drawn}</td>
                <td className={numCellClass}>{r.lost}</td>
                <td className={numCellClass}>{r.gf}</td>
                <td className={numCellClass}>{r.ga}</td>
                <td className={numCellClass}>
                  {r.gd > 0 ? `+${r.gd}` : r.gd}
                </td>
                <td
                  className={`px-2 py-1 font-bold tabular-nums sm:py-1.5 ${
                    isChampion ? "text-amber-100" : "text-white"
                  }`}
                >
                  {r.points}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function KnockoutOverview({
  rounds,
}: {
  rounds: { stage: string; matches: MatchRecord[] }[];
}) {
  return (
    <div className="-mx-1 overflow-x-auto pb-1">
      <div className="flex min-h-[120px] w-max origin-top gap-2 px-1 sm:scale-[0.95] sm:gap-3">
        {rounds.map((round) => {
          const isFinalRound = round.stage.trim().toLowerCase() === "final";
          return (
            <div
              key={round.stage}
              className="flex w-[148px] shrink-0 flex-col gap-1.5 sm:w-[160px]"
            >
              <p
                className={`text-[9px] font-semibold uppercase tracking-[0.18em] ${
                  isFinalRound ? "text-amber-200/85" : "text-white/50"
                }`}
              >
                {round.stage}
              </p>
              <div className="flex flex-col gap-1.5">
                {round.matches.map((m) => (
                  <KnockoutTile
                    key={m.id}
                    match={m}
                    isFinal={isFinalRound}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function KnockoutTile({
  match,
  isFinal,
}: {
  match: MatchRecord;
  isFinal: boolean;
}) {
  const draw = match.homeScore === match.awayScore;
  const homeW = match.homeScore > match.awayScore;
  const awayW = match.awayScore > match.homeScore;
  const showChampion = isFinal && !draw;

  const winnerTeam = showChampion
    ? homeW
      ? match.homeTeam
      : match.awayTeam
    : null;

  const tileClass = showChampion
    ? "rounded-md border border-amber-300/45 bg-gradient-to-b from-amber-300/15 via-amber-300/[0.07] to-black/30 px-2 py-1.5 ring-1 ring-amber-200/20"
    : "rounded-md border border-white/10 bg-black/25 px-2 py-1.5";

  const inner = (
    <div className={tileClass}>
      <div className="flex items-center justify-between gap-1 border-b border-white/5 pb-1">
        <span
          className={`min-w-0 flex-1 truncate text-left text-[10px] leading-tight sm:text-[11px] ${
            draw
              ? "font-medium text-white/75"
              : homeW
                ? showChampion
                  ? "font-bold text-amber-100"
                  : "font-medium text-white"
                : "font-medium text-white/55"
          }`}
        >
          {match.homeTeam}
        </span>
        <span
          className={`shrink-0 text-[11px] font-bold tabular-nums ${
            draw
              ? "text-white/75"
              : homeW
                ? showChampion
                  ? "text-amber-100"
                  : "text-white"
                : "text-white/55"
          }`}
        >
          {match.homeScore}
        </span>
      </div>
      <div className="flex items-center justify-between gap-1 pt-1">
        <span
          className={`min-w-0 flex-1 truncate text-left text-[10px] leading-tight sm:text-[11px] ${
            draw
              ? "font-medium text-white/75"
              : awayW
                ? showChampion
                  ? "font-bold text-amber-100"
                  : "font-medium text-white"
                : "font-medium text-white/55"
          }`}
        >
          {match.awayTeam}
        </span>
        <span
          className={`shrink-0 text-[11px] font-bold tabular-nums ${
            draw
              ? "text-white/75"
              : awayW
                ? showChampion
                  ? "text-amber-100"
                  : "text-white"
                : "text-white/55"
          }`}
        >
          {match.awayScore}
        </span>
      </div>
      {showChampion ? (
        <div className="mt-1 flex items-center gap-1 border-t border-amber-300/20 pt-1">
          <Trophy className="size-2.5 shrink-0 text-amber-200" aria-hidden />
          <span className="truncate text-[9px] font-bold uppercase tracking-[0.14em] text-amber-100">
            Champion · {winnerTeam}
          </span>
        </div>
      ) : null}
    </div>
  );

  if (match.id) {
    return (
      <Link
        href={`/stats/matches/${encodeURIComponent(match.id)}`}
        className="block outline-none transition hover:opacity-95 focus-visible:ring-2 focus-visible:ring-white/35"
      >
        {inner}
      </Link>
    );
  }

  return inner;
}
