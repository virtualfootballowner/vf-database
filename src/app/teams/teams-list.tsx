"use client";

import { Search } from "lucide-react";
import Link from "next/link";
import { useDeferredValue, useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";

import { TeamCrest } from "./team-crest";
import type { Team } from "./teams-data";

type SeasonFilter = "all" | "1" | "2" | "3";

const SEASON_OPTIONS: { value: SeasonFilter; label: string; short: string }[] = [
  { value: "all", label: "All Seasons", short: "All" },
  { value: "1", label: "Season 1", short: "S1" },
  { value: "2", label: "Season 2", short: "S2" },
  { value: "3", label: "Season 3", short: "S3" },
];

type TeamsListProps = {
  teams: Team[];
};

export function TeamsList({ teams }: TeamsListProps) {
  const [query, setQuery] = useState("");
  const [season, setSeason] = useState<SeasonFilter>("all");
  const deferredQuery = useDeferredValue(query);

  const filtered = useMemo(() => {
    const q = deferredQuery.trim().toLowerCase();
    return teams.filter((team) => {
      if (season !== "all" && !team.seasons.includes(Number(season))) {
        return false;
      }
      if (!q) return true;
      return (
        team.name.toLowerCase().includes(q) ||
        team.short.toLowerCase().includes(q)
      );
    });
  }, [deferredQuery, season, teams]);

  const isFiltered = season !== "all" || query.trim().length > 0;

  return (
    <>
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-white/45" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search by team name"
              aria-label="Search teams"
              className="h-11 rounded-full border-white/15 bg-white/5 pl-10 pr-10 text-sm text-white placeholder:text-white/45 focus-visible:border-white/30 focus-visible:ring-white/20 dark:bg-white/5"
            />
            {query ? (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full px-2 py-0.5 text-xs font-semibold text-white/55 transition hover:bg-white/10 hover:text-white"
                aria-label="Clear search"
              >
                Clear
              </button>
            ) : null}
          </div>

          <Badge
            variant="outline"
            className="h-9 shrink-0 gap-2 self-start border-white/15 bg-white/5 px-3 text-white/85 sm:self-auto"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.9)]" />
            {isFiltered
              ? `${filtered.length} of ${teams.length}`
              : `${teams.length} clubs`}
          </Badge>
        </div>

        <div
          role="tablist"
          aria-label="Filter teams by season"
          className="inline-flex w-full gap-1 self-start rounded-full border border-white/10 bg-white/5 p-1 sm:w-auto"
        >
          {SEASON_OPTIONS.map((option) => {
            const isActive = season === option.value;
            return (
              <button
                key={option.value}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => setSeason(option.value)}
                className={`flex-1 rounded-full px-4 py-1.5 text-xs font-semibold transition sm:flex-initial ${
                  isActive
                    ? "bg-white text-zinc-950 shadow-[0_4px_16px_-4px_rgba(255,255,255,0.4)]"
                    : "text-white/70 hover:bg-white/10 hover:text-white"
                }`}
              >
                <span className="hidden sm:inline">{option.label}</span>
                <span className="sm:hidden">{option.short}</span>
              </button>
            );
          })}
        </div>
      </div>

      {filtered.length === 0 ? (
        <Card className="py-8">
          <CardContent className="text-center text-sm text-white/65">
            {teams.length === 0
              ? "No teams in the database yet."
              : `No teams match those filters.`}
          </CardContent>
        </Card>
      ) : (
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((team) => (
            <Link
              key={team.slug}
              href={`/teams/${team.slug}`}
              className="block rounded-xl outline-none transition focus-visible:ring-2 focus-visible:ring-white/40"
            >
              <Card className="h-full gap-3 py-4 transition hover:bg-white/[0.07] hover:ring-white/25">
                <CardHeader className="flex flex-row items-start justify-between gap-4">
                  <div className="flex min-w-0 items-center gap-4">
                    <TeamCrest team={team} />
                    <div className="min-w-0">
                      <CardTitle className="truncate text-xl font-semibold tracking-tight">
                        {team.name}
                      </CardTitle>
                      <CardDescription className="text-white/55">
                        {team.form}
                      </CardDescription>
                    </div>
                  </div>
                  <Badge
                    variant="outline"
                    className="shrink-0 border-white/15 text-white/75"
                  >
                    Active
                  </Badge>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/50">
                      Played
                    </span>
                    {team.seasons.map((s) => (
                      <Badge
                        key={s}
                        variant="outline"
                        className="border-white/15 px-2 py-0 text-[10px] text-white/70"
                      >
                        S{s}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </section>
      )}
    </>
  );
}
