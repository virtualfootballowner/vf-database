import {
  ArrowLeft,
  CalendarDays,
  CircleSlash,
  Crown,
  Swords,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { SiteNav } from "@/components/site-nav";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { getRobloxHeadshots } from "@/lib/roblox";
import {
  getScrimmageMatchByCode,
  type ScrimmageMatchDetail,
  type ScrimmageMatchPlayer,
} from "@/lib/scrimmage/queries";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

type PageParams = { matchCode: string };

export async function generateMetadata({
  params,
}: {
  params: Promise<PageParams>;
}): Promise<Metadata> {
  const { matchCode } = await params;
  const decoded = decodeURIComponent(matchCode);
  return {
    title: `${decoded} · Scrimmage · VF League Database`,
    description: `Match report for VF scrimmage ${decoded}.`,
  };
}

const STATUS_LABEL: Record<string, { label: string; class: string }> = {
  completed: {
    label: "Completed",
    class: "border-emerald-300/35 bg-emerald-400/10 text-emerald-200",
  },
  voided: {
    label: "Voided",
    class: "border-rose-400/35 bg-rose-400/10 text-rose-200",
  },
  cancelled: {
    label: "Cancelled",
    class: "border-rose-400/35 bg-rose-400/10 text-rose-200",
  },
  pending_confirm: {
    label: "Pending confirm",
    class: "border-amber-300/35 bg-amber-400/10 text-amber-200",
  },
  in_progress: {
    label: "In progress",
    class: "border-cyan-300/35 bg-cyan-400/10 text-cyan-200",
  },
  ready_check: {
    label: "Ready check",
    class: "border-cyan-300/35 bg-cyan-400/10 text-cyan-200",
  },
  drafting: {
    label: "Drafting",
    class: "border-cyan-300/35 bg-cyan-400/10 text-cyan-200",
  },
  queueing: {
    label: "Queueing",
    class: "border-white/15 bg-white/5 text-white/85",
  },
};

function statusBadgeProps(status: string) {
  return (
    STATUS_LABEL[status] ?? {
      label: status,
      class: "border-white/15 bg-white/5 text-white/85",
    }
  );
}

function formatDateTime(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
}

async function lookupRobloxIds(
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

export default async function ScrimmageMatchPage({
  params,
}: {
  params: Promise<PageParams>;
}) {
  const { matchCode } = await params;
  const decoded = decodeURIComponent(matchCode);
  const match = await getScrimmageMatchByCode(decoded);
  if (!match) notFound();

  const allPlayerIds = [
    ...match.team1.map((p) => p.playerId),
    ...match.team2.map((p) => p.playerId),
  ];
  const robloxIdsById = await lookupRobloxIds(allPlayerIds);
  const headshots = await getRobloxHeadshots([...robloxIdsById.values()]);

  const status = statusBadgeProps(match.status);
  const isFinal = match.status === "completed";
  const t1Score = match.team1Score ?? 0;
  const t2Score = match.team2Score ?? 0;
  const winner: 1 | 2 | "draw" | null = isFinal
    ? t1Score === t2Score
      ? "draw"
      : t1Score > t2Score
        ? 1
        : 2
    : null;

  return (
    <main className="relative min-h-screen w-full overflow-hidden text-white">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-5 pb-16 pt-6 sm:px-8 sm:pt-10">
        <SiteNav active="scrimmages" />

        <Link
          href="/scrimmages"
          className="inline-flex w-fit items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.2em] text-white/65 transition hover:text-white"
        >
          <ArrowLeft className="size-3.5" />
          All scrimmages
        </Link>

        <section className="flex flex-col gap-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.32em] text-white/55">
            Scrimmage Report
          </p>
          <div className="flex flex-wrap items-baseline gap-3">
            <h1 className="font-mono text-3xl font-semibold tracking-tight sm:text-4xl">
              {match.matchCode}
            </h1>
            <Badge
              variant="outline"
              className={`shrink-0 ${status.class}`}
            >
              {status.label}
            </Badge>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-xs text-white/55">
            <span className="inline-flex items-center gap-1.5">
              <CalendarDays className="size-3.5" />
              {formatDateTime(match.playedAt)}
            </span>
            {match.playerCount ? (
              <>
                <span className="text-white/25">·</span>
                <span>{match.playerCount}v{match.playerCount} match</span>
              </>
            ) : null}
            {match.hostName ? (
              <>
                <span className="text-white/25">·</span>
                <span>Host: {match.hostName}</span>
              </>
            ) : null}
          </div>
        </section>

        <ScoreLine match={match} winner={winner} />

        {match.status === "voided" || match.status === "cancelled" ? (
          <Card className="py-6">
            <div className="flex items-start gap-3 px-5">
              <CircleSlash className="mt-0.5 size-5 shrink-0 text-rose-300" />
              <div>
                <p className="text-sm font-semibold text-white">
                  This match was{" "}
                  {match.status === "voided" ? "voided" : "cancelled"}.
                </p>
                <p className="mt-1 text-xs text-white/65">
                  No ELO was applied. Records are kept for audit purposes.
                </p>
              </div>
            </div>
          </Card>
        ) : null}

        <section className="grid gap-4 lg:grid-cols-2">
          <RosterCard
            teamLabel="Team 1"
            captainName={match.team1CaptainName}
            avgElo={match.team1AvgElo}
            score={match.team1Score}
            isWinner={winner === 1}
            isDraw={winner === "draw"}
            roster={match.team1}
            robloxIdsById={robloxIdsById}
            headshots={headshots}
          />
          <RosterCard
            teamLabel="Team 2"
            captainName={match.team2CaptainName}
            avgElo={match.team2AvgElo}
            score={match.team2Score}
            isWinner={winner === 2}
            isDraw={winner === "draw"}
            roster={match.team2}
            robloxIdsById={robloxIdsById}
            headshots={headshots}
          />
        </section>

        {(match.reportedByName ||
          match.confirmedByName ||
          match.matchStartedAt ||
          match.queueStartedAt) && (
          <Card className="py-5">
            <div className="grid gap-3 px-5 sm:grid-cols-2 lg:grid-cols-4">
              <MetaPair label="Queue started" value={formatDateTime(match.queueStartedAt ?? "")} />
              <MetaPair label="Match started" value={formatDateTime(match.matchStartedAt ?? "")} />
              <MetaPair label="Reported by" value={match.reportedByName ?? "—"} />
              <MetaPair label="Confirmed by" value={match.confirmedByName ?? "—"} />
            </div>
          </Card>
        )}
      </div>
    </main>
  );
}

function ScoreLine({
  match,
  winner,
}: {
  match: ScrimmageMatchDetail;
  winner: 1 | 2 | "draw" | null;
}) {
  const t1 = match.team1Score;
  const t2 = match.team2Score;
  const t1Class =
    winner === 1
      ? "text-emerald-200"
      : winner === 2
        ? "text-white/45"
        : "text-white";
  const t2Class =
    winner === 2
      ? "text-emerald-200"
      : winner === 1
        ? "text-white/45"
        : "text-white";

  return (
    <Card className="gap-0 py-6">
      <div className="flex items-center justify-around gap-3 px-4 sm:gap-6">
        <div className="flex flex-col items-center gap-1">
          <p className="text-[10px] font-semibold uppercase tracking-[0.32em] text-white/55">
            Team 1
          </p>
          <p
            className={`font-mono text-5xl font-semibold tabular-nums sm:text-6xl ${t1Class}`}
          >
            {t1 ?? "—"}
          </p>
          {match.team1AvgElo != null ? (
            <p className="text-[11px] text-white/55">
              {match.team1AvgElo.toLocaleString()} avg ELO
            </p>
          ) : null}
        </div>
        <div className="flex flex-col items-center gap-2">
          <Swords className="size-6 text-white/45 sm:size-8" />
          <p className="text-[10px] font-semibold uppercase tracking-[0.32em] text-white/55">
            vs
          </p>
        </div>
        <div className="flex flex-col items-center gap-1">
          <p className="text-[10px] font-semibold uppercase tracking-[0.32em] text-white/55">
            Team 2
          </p>
          <p
            className={`font-mono text-5xl font-semibold tabular-nums sm:text-6xl ${t2Class}`}
          >
            {t2 ?? "—"}
          </p>
          {match.team2AvgElo != null ? (
            <p className="text-[11px] text-white/55">
              {match.team2AvgElo.toLocaleString()} avg ELO
            </p>
          ) : null}
        </div>
      </div>
    </Card>
  );
}

function RosterCard({
  teamLabel,
  captainName,
  avgElo,
  score,
  isWinner,
  isDraw,
  roster,
  robloxIdsById,
  headshots,
}: {
  teamLabel: string;
  captainName: string | null;
  avgElo: number | null;
  score: number | null;
  isWinner: boolean;
  isDraw: boolean;
  roster: ScrimmageMatchPlayer[];
  robloxIdsById: Map<string, string>;
  headshots: Map<string, string>;
}) {
  const headerToneClass = isWinner
    ? "border-emerald-400/35 bg-emerald-400/10"
    : isDraw
      ? "border-amber-400/35 bg-amber-400/10"
      : "border-white/15 bg-white/5";

  return (
    <Card className="gap-0 overflow-hidden py-0">
      <div
        className={`flex items-center justify-between gap-3 border-b px-4 py-3 ${headerToneClass}`}
      >
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.32em] text-white/55">
            {teamLabel}
            {isWinner ? " · WINNER" : ""}
          </p>
          <p className="mt-0.5 truncate text-sm font-semibold text-white">
            Captain: {captainName ?? "Unknown"}
          </p>
          {avgElo != null ? (
            <p className="mt-0.5 text-[11px] text-white/55">
              Avg {avgElo.toLocaleString()} ELO
            </p>
          ) : null}
        </div>
        <div className="shrink-0 text-right">
          <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/55">
            Score
          </span>
          <p className="font-mono text-2xl font-semibold tabular-nums text-white">
            {score ?? "—"}
          </p>
        </div>
      </div>

      <ul className="flex flex-col">
        {roster.map((p, i) => (
          <PlayerRosterRow
            key={p.playerId}
            player={p}
            robloxId={robloxIdsById.get(p.playerId) ?? null}
            headshot={
              robloxIdsById.get(p.playerId)
                ? headshots.get(robloxIdsById.get(p.playerId)!) ?? null
                : null
            }
            isLast={i === roster.length - 1}
          />
        ))}
        {roster.length === 0 ? (
          <li className="px-4 py-6 text-center text-xs text-white/55">
            No roster recorded.
          </li>
        ) : null}
      </ul>
    </Card>
  );
}

function PlayerRosterRow({
  player,
  headshot,
  isLast,
}: {
  player: ScrimmageMatchPlayer;
  robloxId: string | null;
  headshot: string | null;
  isLast: boolean;
}) {
  const delta = player.eloChange;
  const deltaTone =
    delta == null
      ? "text-white/55"
      : delta > 0
        ? "text-emerald-300"
        : delta < 0
          ? "text-rose-300"
          : "text-white/65";
  const deltaText =
    delta == null ? "—" : delta >= 0 ? `+${delta}` : `${delta}`;

  return (
    <li className={`px-4 py-2.5 ${isLast ? "" : "border-b border-white/5"}`}>
      <Link
        href={`/players/${encodeURIComponent(player.robloxUsername)}`}
        className="-mx-2 flex items-center gap-3 rounded-md px-2 py-1 transition hover:bg-white/5"
      >
        <span className="w-5 shrink-0 text-center text-[11px] font-semibold tabular-nums text-white/45">
          {player.pickOrder ?? "—"}
        </span>
        <Avatar className="size-8 shrink-0 bg-[#083696]/40 ring-1 ring-white/15">
          {headshot ? (
            <AvatarImage
              src={headshot}
              alt={`${player.robloxUsername} headshot`}
            />
          ) : null}
          <AvatarFallback className="bg-[#083696] text-[10px] font-bold uppercase text-white">
            {player.robloxUsername.slice(0, 2)}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <p className="truncate text-sm font-semibold text-white">
              {player.robloxUsername}
            </p>
            {player.isCaptain ? (
              <Crown
                className="size-3.5 text-amber-200/95"
                aria-label="Captain"
              />
            ) : null}
            {player.preferredPosition ? (
              <Badge
                variant="outline"
                className="border-white/15 px-1.5 py-0 text-[10px] font-semibold uppercase tracking-wider text-white/65"
              >
                {player.preferredPosition}
              </Badge>
            ) : null}
            {player.isAfk ? (
              <Badge
                variant="outline"
                className="border-rose-400/35 bg-rose-400/10 px-1.5 py-0 text-[10px] font-semibold uppercase tracking-wider text-rose-200/95"
              >
                AFK
              </Badge>
            ) : null}
          </div>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/45">
            ELO
          </p>
          <p className="text-xs tabular-nums text-white/85">
            {player.eloBefore} → {player.eloAfter ?? "—"}
          </p>
          <p
            className={`text-[11px] font-semibold tabular-nums ${deltaTone}`}
          >
            {deltaText}
          </p>
        </div>
      </Link>
    </li>
  );
}

function MetaPair({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/45">
        {label}
      </p>
      <p className="mt-0.5 text-sm text-white/85">{value}</p>
    </div>
  );
}
