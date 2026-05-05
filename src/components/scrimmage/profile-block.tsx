import Link from "next/link";
import { ArrowRight, Swords } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  getRecentScrimmagesForPlayer,
  getScrimmageRating,
  type ScrimmageRating,
} from "@/lib/scrimmage/queries";

import { ScrimmageMatchRow } from "./match-row";

type Props = {
  playerId: string;
  robloxUsername: string;
};

/**
 * FACEIT block for a player profile. Shows current ELO, peak, rank, W/L/D,
 * win-rate, current streak, AFK strikes + the last 5 scrimmages.
 *
 * Renders a "no scrimmages yet" state if the player has no rating row.
 * Block is hidden entirely if the player has no rating row AND no matches —
 * keeps profiles of pre-FACEIT-era players uncluttered.
 */
export async function PlayerScrimmageBlock({
  playerId,
  robloxUsername,
}: Props) {
  const [rating, recent] = await Promise.all([
    getScrimmageRating(playerId),
    getRecentScrimmagesForPlayer(playerId, 5),
  ]);

  // No rating row + no matches → render nothing.
  if (!rating && recent.length === 0) return null;

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between sm:gap-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.32em] text-white/55">
            Scrimmages
          </p>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">
            FACEIT record
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-white/55">
            Competitive scrim ELO, win/loss record, and recent matches.
          </p>
        </div>
        {rating && rating.gamesPlayed > 0 ? (
          <Link
            href={`/players/${encodeURIComponent(robloxUsername)}/scrimmages`}
            className="inline-flex w-fit items-center gap-1.5 self-start rounded-full border border-white/15 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.2em] text-white/75 transition hover:bg-white/10 hover:text-white sm:self-auto"
          >
            Full history
            <ArrowRight className="size-3.5" />
          </Link>
        ) : null}
      </div>

      <RatingTiles rating={rating} />

      {recent.length > 0 ? (
        <div className="flex flex-col gap-2">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/55">
            Last {recent.length} match{recent.length === 1 ? "" : "es"}
          </p>
          <div className="flex flex-col gap-2">
            {recent.map((m) => (
              <ScrimmageMatchRow key={m.matchId} match={m} />
            ))}
          </div>
        </div>
      ) : (
        <Card className="py-8">
          <CardHeader className="flex flex-row items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-lg bg-cyan-400/15 text-cyan-200 ring-1 ring-cyan-300/25">
              <Swords className="size-4" />
            </div>
            <div>
              <CardTitle className="text-base font-semibold">
                No scrimmages yet
              </CardTitle>
              <CardDescription className="text-white/55">
                When this player joins a /scrimmage queue and finishes a
                ranked match, their FACEIT history will appear here.
              </CardDescription>
            </div>
          </CardHeader>
        </Card>
      )}
    </section>
  );
}

function RatingTiles({ rating }: { rating: ScrimmageRating | null }) {
  const elo = rating?.elo ?? 1000;
  const peak = rating?.peakElo ?? 1000;
  const w = rating?.wins ?? 0;
  const l = rating?.losses ?? 0;
  const d = rating?.draws ?? 0;
  const games = rating?.gamesPlayed ?? 0;
  const winRate = games > 0 ? Math.round(((w + d * 0.5) / games) * 100) : null;
  const streak = rating?.currentStreak ?? 0;
  const rank = rating?.rank;

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      <Tile
        label="ELO"
        value={elo.toLocaleString()}
        accent="text-cyan-100"
        sub={rank ? `Rank #${rank}` : games === 0 ? "Unranked" : undefined}
      />
      <Tile label="Peak" value={peak.toLocaleString()} />
      <Tile
        label="Record"
        value={`${w}-${d}-${l}`}
        sub={winRate != null ? `${winRate}% WR` : undefined}
      />
      <Tile label="Games" value={games} />
      <Tile
        label="Streak"
        value={streak === 0 ? "—" : signed(streak)}
        accent={
          streak > 0
            ? "text-emerald-200"
            : streak < 0
              ? "text-rose-200"
              : undefined
        }
      />
      <Tile
        label="AFK"
        value={rating?.afkCount ?? 0}
        sub={
          rating?.banUntil
            ? `Banned until ${new Date(rating.banUntil).toLocaleDateString()}`
            : undefined
        }
      />
    </div>
  );
}

function signed(n: number): string {
  return n >= 0 ? `+${n}` : `${n}`;
}

function Tile({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string | number;
  sub?: string;
  accent?: string;
}) {
  return (
    <Card className="gap-1 py-4">
      <CardContent>
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/55">
          {label}
        </p>
        <p
          className={`mt-1.5 text-2xl font-semibold ${accent ?? "text-white"}`}
        >
          {value}
        </p>
        {sub ? (
          <Badge
            variant="outline"
            className="mt-2 border-white/15 px-1.5 py-0 text-[10px] font-medium uppercase tracking-wider text-white/65"
          >
            {sub}
          </Badge>
        ) : null}
      </CardContent>
    </Card>
  );
}
