import { ChevronLeft, ChevronRight, Crown, Swords } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { LeaderboardSearch } from "@/components/scrimmage/leaderboard-search";
import { SiteNav } from "@/components/site-nav";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { getRobloxHeadshots } from "@/lib/roblox";
import { getScrimmageLeaderboard } from "@/lib/scrimmage/queries";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Scrimmages · VF League Database",
  description:
    "Live FACEIT-style ELO leaderboard for VF League scrimmages. Top players ranked by competitive scrim rating.",
};

const PAGE_SIZE = 25;

type SearchParams = Promise<{
  page?: string;
  q?: string;
}>;

function parsePage(input: string | undefined): number {
  if (!input) return 1;
  const n = Number.parseInt(input, 10);
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.min(n, 1000);
}

function rankBadge(rank: number) {
  if (rank === 1)
    return {
      label: "1",
      class:
        "border-amber-300/45 bg-amber-300/15 text-amber-100",
    };
  if (rank === 2)
    return {
      label: "2",
      class:
        "border-zinc-200/35 bg-zinc-200/10 text-zinc-100",
    };
  if (rank === 3)
    return {
      label: "3",
      class:
        "border-orange-400/35 bg-orange-400/10 text-orange-200",
    };
  return {
    label: rank.toString(),
    class: "border-white/10 bg-white/5 text-white/65",
  };
}

async function lookupRobloxIdsByPlayerIds(
  playerIds: string[],
): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (playerIds.length === 0) return out;
  const supabase = createSupabaseServerClient();
  const { data } = await supabase
    .from("players")
    .select("id, roblox_user_id")
    .in("id", playerIds);
  for (const row of (data ?? []) as {
    id: string;
    roblox_user_id: string | null;
  }[]) {
    if (row.roblox_user_id) out.set(row.id, row.roblox_user_id);
  }
  return out;
}

export default async function ScrimmagesLeaderboardPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  const page = parsePage(sp.page);
  const q = sp.q?.trim() || undefined;
  const offset = (page - 1) * PAGE_SIZE;

  const { rows, totalActive } = await getScrimmageLeaderboard({
    limit: PAGE_SIZE,
    offset,
    search: q,
  });

  const robloxIdsById = await lookupRobloxIdsByPlayerIds(
    rows.map((r) => r.playerId),
  );
  const robloxIds = [...robloxIdsById.values()];
  const headshots = await getRobloxHeadshots(robloxIds);

  // Pagination is approximate: a search restricts the universe, so we just
  // disable the "next" button when fewer than PAGE_SIZE rows came back.
  const hasNext = !q && rows.length === PAGE_SIZE && offset + PAGE_SIZE < totalActive;
  const hasPrev = page > 1;

  const baseHref = (p: number) => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (p > 1) params.set("page", p.toString());
    const qs = params.toString();
    return qs ? `/scrimmages?${qs}` : "/scrimmages";
  };

  return (
    <main className="relative min-h-screen w-full overflow-hidden text-white">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-5 pb-16 pt-6 sm:px-8 sm:pt-10">
        <SiteNav active="scrimmages" />

        <section className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.32em] text-white/55">
              FACEIT Mode
            </p>
            <h1 className="mt-2 flex items-center gap-3 text-4xl font-semibold tracking-tight sm:text-5xl">
              <Swords className="size-8 text-cyan-200/90 sm:size-10" />
              Scrimmages
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-white/70 sm:text-base">
              Live ELO leaderboard for VF League competitive scrims. Players
              earn or lose ELO based on scrim wins, losses, and the gap between
              their team&apos;s average rating and their opponents&apos;.
            </p>
          </div>
          <Badge
            variant="outline"
            className="self-start border-white/15 bg-white/5 text-white/85"
          >
            {totalActive.toLocaleString()} active player
            {totalActive === 1 ? "" : "s"}
          </Badge>
        </section>

        <LeaderboardSearch initialQuery={q ?? ""} />

        {rows.length === 0 ? (
          <Card className="py-12">
            <div className="flex flex-col items-center gap-3 text-center">
              <Swords className="size-8 text-white/35" />
              <p className="text-sm font-semibold text-white">
                {q
                  ? `No players found matching "${q}".`
                  : "No scrimmages have been played yet."}
              </p>
              {q ? (
                <Link
                  href="/scrimmages"
                  className="text-xs font-semibold uppercase tracking-[0.2em] text-white/65 transition hover:text-white"
                >
                  Clear search
                </Link>
              ) : (
                <p className="max-w-md text-xs text-white/55">
                  Once <code className="rounded bg-white/10 px-1.5 py-0.5 text-white/80">/scrimmage start</code>{" "}
                  matches finish in Discord, results land here.
                </p>
              )}
            </div>
          </Card>
        ) : (
          <div className="flex flex-col gap-2">
            {rows.map((row) => {
              const badge = rankBadge(row.rank);
              const robloxId = robloxIdsById.get(row.playerId);
              const headshot = robloxId ? headshots.get(robloxId) : undefined;
              const winRate =
                row.gamesPlayed > 0
                  ? Math.round(
                      ((row.wins + row.draws * 0.5) / row.gamesPlayed) * 100,
                    )
                  : 0;
              return (
                <Link
                  key={row.playerId}
                  href={`/players/${encodeURIComponent(row.robloxUsername)}`}
                  className="block rounded-xl outline-none transition focus-visible:ring-2 focus-visible:ring-white/40"
                >
                  <Card className="gap-0 py-0 transition hover:bg-white/[0.07] hover:ring-white/25">
                    <div className="flex items-center gap-3 px-4 py-3 sm:gap-4">
                      <Badge
                        variant="outline"
                        className={`shrink-0 min-w-[2.25rem] justify-center rounded-md border px-1.5 py-0.5 text-sm font-bold tabular-nums ${badge.class}`}
                      >
                        {badge.label}
                      </Badge>

                      <Avatar className="size-10 shrink-0 bg-[#083696]/40 ring-1 ring-white/15 sm:size-11">
                        {headshot ? (
                          <AvatarImage
                            src={headshot}
                            alt={`${row.robloxUsername} headshot`}
                          />
                        ) : null}
                        <AvatarFallback className="bg-[#083696] text-xs font-bold uppercase text-white">
                          {row.robloxUsername.slice(0, 2)}
                        </AvatarFallback>
                      </Avatar>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <p className="truncate text-sm font-semibold text-white sm:text-base">
                            {row.robloxUsername}
                          </p>
                          {row.rank === 1 ? (
                            <Crown
                              className="size-4 text-amber-200/95"
                              aria-label="#1"
                            />
                          ) : null}
                        </div>
                        <p className="mt-0.5 text-[11px] tabular-nums text-white/55">
                          {row.wins}W · {row.draws}D · {row.losses}L
                          <span className="mx-1.5 text-white/25">·</span>
                          {winRate}% WR
                          <span className="mx-1.5 text-white/25">·</span>
                          {row.gamesPlayed} game
                          {row.gamesPlayed === 1 ? "" : "s"}
                        </p>
                      </div>

                      <div className="hidden shrink-0 sm:block sm:text-right">
                        <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/45">
                          Peak
                        </span>
                        <p className="text-sm font-semibold tabular-nums text-white/85">
                          {row.peakElo.toLocaleString()}
                        </p>
                      </div>

                      <div className="shrink-0 text-right">
                        <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/45">
                          ELO
                        </span>
                        <p className="text-lg font-semibold tabular-nums text-cyan-100 sm:text-xl">
                          {row.elo.toLocaleString()}
                        </p>
                      </div>
                    </div>
                  </Card>
                </Link>
              );
            })}
          </div>
        )}

        {(hasPrev || hasNext) && rows.length > 0 ? (
          <nav
            aria-label="Leaderboard pagination"
            className="mt-2 flex items-center justify-between gap-3"
          >
            {hasPrev ? (
              <Link
                href={baseHref(page - 1)}
                className="inline-flex items-center gap-1.5 rounded-full border border-white/15 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.2em] text-white/75 transition hover:bg-white/10 hover:text-white"
              >
                <ChevronLeft className="size-3.5" />
                Prev
              </Link>
            ) : (
              <span aria-hidden />
            )}
            <p className="text-[11px] uppercase tracking-[0.2em] text-white/55">
              Page {page}
            </p>
            {hasNext ? (
              <Link
                href={baseHref(page + 1)}
                className="inline-flex items-center gap-1.5 rounded-full border border-white/15 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.2em] text-white/75 transition hover:bg-white/10 hover:text-white"
              >
                Next
                <ChevronRight className="size-3.5" />
              </Link>
            ) : (
              <span aria-hidden />
            )}
          </nav>
        ) : null}
      </div>
    </main>
  );
}
