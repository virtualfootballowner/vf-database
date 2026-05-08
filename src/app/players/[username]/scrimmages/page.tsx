import { ArrowLeft, ChevronLeft, ChevronRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ScrimmageMatchRow } from "@/components/scrimmage/match-row";
import { SiteNav } from "@/components/site-nav";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { getRobloxHeadshots, isVerifiedRobloxUserId } from "@/lib/roblox";
import {
  countCompletedScrimmagesForPlayer,
  getScrimmageRating,
  getScrimmagesForPlayerPaged,
} from "@/lib/scrimmage/queries";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 20;

type PageParams = { username: string };
type SearchParams = Promise<{ page?: string }>;

export async function generateMetadata({
  params,
}: {
  params: Promise<PageParams>;
}): Promise<Metadata> {
  const { username } = await params;
  const decoded = decodeURIComponent(username);
  return {
    title: `${decoded}'s scrimmages · VF League Database`,
    description: `Full FACEIT scrimmage history for ${decoded}.`,
  };
}

type PlayerRow = {
  id: string;
  roblox_username: string;
  roblox_user_id: string | null;
  position: string | null;
};

async function getPlayer(username: string): Promise<PlayerRow | null> {
  try {
    const supabase = createSupabaseServerClient();
    const { data, error } = await supabase
      .from("players")
      .select("id, roblox_username, roblox_user_id, position")
      .ilike("roblox_username", username)
      .maybeSingle();
    if (error || !data) return null;
    return data as PlayerRow;
  } catch {
    return null;
  }
}

function parsePage(input: string | undefined): number {
  if (!input) return 1;
  const n = Number.parseInt(input, 10);
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.min(n, 1000);
}

export default async function PlayerScrimmagesPage({
  params,
  searchParams,
}: {
  params: Promise<PageParams>;
  searchParams: SearchParams;
}) {
  const [{ username }, sp] = await Promise.all([params, searchParams]);
  const decoded = decodeURIComponent(username);
  const player = await getPlayer(decoded);
  if (!player || !isVerifiedRobloxUserId(player.roblox_user_id)) notFound();

  const page = parsePage(sp.page);
  const offset = (page - 1) * PAGE_SIZE;

  const [rating, matches, total, headshotsMap] = await Promise.all([
    getScrimmageRating(player.id),
    getScrimmagesForPlayerPaged({
      playerId: player.id,
      limit: PAGE_SIZE,
      offset,
    }),
    countCompletedScrimmagesForPlayer(player.id),
    getRobloxHeadshots([player.roblox_user_id]),
  ]);
  const headshot = headshotsMap.get(player.roblox_user_id);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const hasPrev = page > 1;
  const hasNext = page < totalPages;

  const baseHref = (p: number) => {
    const params = new URLSearchParams();
    if (p > 1) params.set("page", p.toString());
    const qs = params.toString();
    return qs
      ? `/players/${encodeURIComponent(player.roblox_username)}/scrimmages?${qs}`
      : `/players/${encodeURIComponent(player.roblox_username)}/scrimmages`;
  };

  return (
    <main className="relative min-h-dvh min-w-0 w-full overflow-x-clip text-white">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 pb-16 pt-5 sm:px-6 sm:pt-8 md:px-8 md:pt-10">
        <SiteNav active="players" />

        <Link
          href={`/players/${encodeURIComponent(player.roblox_username)}`}
          className="inline-flex w-fit items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.2em] text-white/65 transition hover:text-white"
        >
          <ArrowLeft className="size-3.5" />
          Back to profile
        </Link>

        <section className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:gap-6">
          <Avatar className="size-16 shrink-0 bg-[#083696]/40 ring-2 ring-white/15 sm:size-20">
            {headshot ? (
              <AvatarImage
                src={headshot}
                alt={`${player.roblox_username} headshot`}
              />
            ) : null}
            <AvatarFallback className="bg-[#083696] text-lg font-black uppercase text-white">
              {player.roblox_username.slice(0, 2)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.32em] text-white/55">
              Scrimmage History
            </p>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight sm:text-4xl">
              {player.roblox_username}
            </h1>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {rating ? (
                <>
                  <Badge
                    variant="outline"
                    className="border-cyan-300/35 bg-cyan-400/10 text-cyan-100"
                  >
                    {rating.elo.toLocaleString()} ELO
                  </Badge>
                  <Badge
                    variant="outline"
                    className="border-white/15 bg-white/5 text-white/85"
                  >
                    {rating.wins}W · {rating.draws}D · {rating.losses}L
                  </Badge>
                  {rating.rank ? (
                    <Badge
                      variant="outline"
                      className="border-white/15 bg-white/5 text-white/85"
                    >
                      Rank #{rating.rank}
                    </Badge>
                  ) : null}
                </>
              ) : (
                <Badge
                  variant="outline"
                  className="border-white/15 bg-white/5 text-white/55"
                >
                  Unranked
                </Badge>
              )}
            </div>
          </div>
        </section>

        {matches.length === 0 ? (
          <Card className="py-12">
            <div className="flex flex-col items-center gap-3 px-6 text-center">
              <p className="text-sm font-semibold text-white">
                {page > 1
                  ? "No more matches on this page."
                  : "No completed scrimmages yet."}
              </p>
              {page > 1 ? (
                <Link
                  href={baseHref(1)}
                  className="text-xs font-semibold uppercase tracking-[0.2em] text-white/65 transition hover:text-white"
                >
                  Back to first page
                </Link>
              ) : (
                <p className="max-w-md text-xs text-white/55">
                  When this player joins{" "}
                  <code className="rounded bg-white/10 px-1.5 py-0.5 text-white/80">
                    /scrimmage start
                  </code>{" "}
                  matches and they finish, results land here.
                </p>
              )}
            </div>
          </Card>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-semibold uppercase tracking-[0.32em] text-white/55">
                {total} completed match{total === 1 ? "" : "es"}
              </p>
              <p className="text-[11px] uppercase tracking-[0.2em] text-white/45">
                Page {page} of {totalPages}
              </p>
            </div>
            <div className="flex flex-col gap-2">
              {matches.map((m) => (
                <ScrimmageMatchRow key={m.matchId} match={m} />
              ))}
            </div>
          </>
        )}

        {(hasPrev || hasNext) && matches.length > 0 ? (
          <nav
            aria-label="History pagination"
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
              Page {page} / {totalPages}
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
