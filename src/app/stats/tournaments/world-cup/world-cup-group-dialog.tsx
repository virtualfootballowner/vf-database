"use client";

import type { ReactNode } from "react";
import Link from "next/link";

import { TeamCrest } from "@/app/teams/team-crest";
import type { Team } from "@/app/teams/teams-data";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { WorldCupGroupBundle } from "@/lib/s3-world-cup-group-standings";
import type { StandingRow } from "@/lib/stats-tournaments";

function GroupStandingsTable({
  rows,
  teamsBySlug,
}: {
  rows: StandingRow[];
  teamsBySlug: Record<string, Team>;
}) {
  return (
    <div className="overflow-x-auto rounded-lg border border-white/10 bg-black/30">
      <table className="w-full min-w-[360px] border-collapse text-[11px] sm:text-xs">
        <thead>
          <tr className="border-b border-white/10 text-left text-[9px] font-semibold uppercase tracking-wider text-white/45">
            <th className="px-2 py-2">#</th>
            <th className="px-2 py-2">Team</th>
            <th className="px-1 py-2 tabular-nums">P</th>
            <th className="px-1 py-2 tabular-nums">W</th>
            <th className="px-1 py-2 tabular-nums">D</th>
            <th className="px-1 py-2 tabular-nums">L</th>
            <th className="px-1 py-2 tabular-nums">GF</th>
            <th className="px-1 py-2 tabular-nums">GA</th>
            <th className="px-1 py-2 tabular-nums">GD</th>
            <th className="px-2 py-2 font-bold tabular-nums">Pts</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const team = r.slug ? teamsBySlug[r.slug] : undefined;
            return (
              <tr
                key={r.slug ?? r.team}
                className="border-b border-white/5 last:border-0 hover:bg-white/[0.04]"
              >
                <td className="px-2 py-1.5 tabular-nums text-white/50">{i + 1}</td>
                <td className="max-w-[140px] px-2 py-1.5 sm:max-w-[180px]">
                  <div className="flex items-center gap-2">
                    {team ? (
                      <span className="shrink-0">
                        <TeamCrest team={team} size="xs" />
                      </span>
                    ) : null}
                    {r.slug ? (
                      <Link
                        href={`/teams/${encodeURIComponent(r.slug)}`}
                        className="truncate font-medium text-white underline decoration-white/25 underline-offset-2 hover:decoration-white/60"
                      >
                        {r.team}
                      </Link>
                    ) : (
                      <span className="truncate font-medium text-white/90">
                        {r.team}
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-1 py-1.5 tabular-nums text-white/75">{r.played}</td>
                <td className="px-1 py-1.5 tabular-nums text-white/75">{r.won}</td>
                <td className="px-1 py-1.5 tabular-nums text-white/75">{r.drawn}</td>
                <td className="px-1 py-1.5 tabular-nums text-white/75">{r.lost}</td>
                <td className="px-1 py-1.5 tabular-nums text-white/75">{r.gf}</td>
                <td className="px-1 py-1.5 tabular-nums text-white/75">{r.ga}</td>
                <td className="px-1 py-1.5 tabular-nums text-white/75">
                  {r.gd > 0 ? `+${r.gd}` : r.gd}
                </td>
                <td className="px-2 py-1.5 font-bold tabular-nums text-white">
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

export function WorldCupGroupDialog({
  bundle,
  teamsBySlug,
  children,
}: {
  bundle: WorldCupGroupBundle;
  teamsBySlug: Record<string, Team>;
  children: ReactNode;
}) {
  const played = bundle.matches.filter((m) => m.played);
  const upcoming = bundle.matches.filter((m) => !m.played);

  return (
    <Dialog>
      <DialogTrigger
        nativeButton={false}
        className="block w-full cursor-pointer text-left outline-none focus-visible:ring-2 focus-visible:ring-white/35 rounded-lg"
      >
        {children}
      </DialogTrigger>
      <DialogContent className="max-h-[min(90vh,720px)] overflow-y-auto border-white/10 bg-zinc-950 text-white sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold tracking-tight text-white">
            Group {bundle.letter}
          </DialogTitle>
          <DialogDescription className="text-white/55">
            Standings and results — top two advance, plus best third-place sides
            across the tournament.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-5">
          <div>
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-white/45">
              Table
            </p>
            <GroupStandingsTable rows={bundle.standings} teamsBySlug={teamsBySlug} />
          </div>

          <div>
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-white/45">
              Results
            </p>
            {played.length === 0 ? (
              <p className="rounded-lg border border-white/10 bg-black/25 px-3 py-4 text-sm text-white/55">
                No group matches played yet.
              </p>
            ) : (
              <ul className="flex flex-col gap-1.5">
                {played.map((m) => {
                  const homeTeam = m.homeSlug ? teamsBySlug[m.homeSlug] : undefined;
                  const awayTeam = m.awaySlug ? teamsBySlug[m.awaySlug] : undefined;
                  const homeW = m.homeScore > m.awayScore;
                  const awayW = m.awayScore > m.homeScore;
                  const draw = m.homeScore === m.awayScore;

                  return (
                    <li key={m.id}>
                      <Link
                        href={`/stats/matches/${encodeURIComponent(m.id)}`}
                        className="flex flex-col gap-1 rounded-lg border border-white/10 bg-black/25 px-3 py-2.5 outline-none transition hover:border-white/20 hover:bg-black/40 focus-visible:ring-2 focus-visible:ring-white/35 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div className="flex min-w-0 flex-1 items-center justify-between gap-2 sm:justify-center sm:gap-3">
                          <div className="flex min-w-0 flex-1 items-center justify-end gap-1.5">
                            {homeTeam ? (
                              <TeamCrest team={homeTeam} size="xs" />
                            ) : null}
                            <span
                              className={`truncate text-xs font-medium sm:text-sm ${
                                draw
                                  ? "text-white/75"
                                  : homeW
                                    ? "font-semibold text-white"
                                    : "text-white/55"
                              }`}
                            >
                              {m.homeTeam}
                            </span>
                          </div>
                          <span className="shrink-0 rounded-md bg-white/10 px-2 py-0.5 text-xs font-bold tabular-nums text-white sm:text-sm">
                            {m.homeScore} – {m.awayScore}
                          </span>
                          <div className="flex min-w-0 flex-1 items-center gap-1.5">
                            {awayTeam ? (
                              <TeamCrest team={awayTeam} size="xs" />
                            ) : null}
                            <span
                              className={`truncate text-xs font-medium sm:text-sm ${
                                draw
                                  ? "text-white/75"
                                  : awayW
                                    ? "font-semibold text-white"
                                    : "text-white/55"
                              }`}
                            >
                              {m.awayTeam}
                            </span>
                          </div>
                        </div>
                        <p className="shrink-0 text-[10px] tabular-nums text-white/40 sm:text-right">
                          {m.gameWeek !== "—" ? `${m.gameWeek} · ` : ""}
                          {m.date}
                        </p>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {upcoming.length > 0 ? (
            <div>
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-white/45">
                Upcoming ({upcoming.length})
              </p>
              <ul className="flex flex-col gap-1">
                {upcoming.map((m) => (
                  <li
                    key={m.id}
                    className="rounded-md border border-white/8 bg-white/[0.03] px-3 py-2 text-[11px] text-white/55 sm:text-xs"
                  >
                    <span className="font-medium text-white/75">{m.homeTeam}</span>
                    <span className="mx-1.5 text-white/30">vs</span>
                    <span className="font-medium text-white/75">{m.awayTeam}</span>
                    <span className="ml-2 text-white/40">
                      · {m.gameWeek !== "—" ? m.gameWeek : m.date}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
