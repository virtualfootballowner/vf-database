import { Radio } from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  getRecentScrimmageMatches,
  type ScrimmageMatchSummary,
} from "@/lib/scrimmage/queries";

const STATUS_PILLS: Record<
  string,
  { label: string; class: string; live?: boolean }
> = {
  live: {
    label: "LIVE",
    class: "border-rose-400/45 bg-rose-500/15 text-rose-100",
    live: true,
  },
  pending_confirmation: {
    label: "PENDING",
    class: "border-amber-300/45 bg-amber-300/15 text-amber-100",
  },
  completed: {
    label: "FINAL",
    class: "border-emerald-300/45 bg-emerald-400/15 text-emerald-100",
  },
  voided: {
    label: "VOIDED",
    class: "border-rose-400/35 bg-rose-400/10 text-rose-200",
  },
};

function statusPill(status: string) {
  return (
    STATUS_PILLS[status] ?? {
      label: status.toUpperCase(),
      class: "border-white/15 bg-white/5 text-white/85",
    }
  );
}

function timeAgo(iso: string): string {
  try {
    const t = new Date(iso).getTime();
    if (!Number.isFinite(t)) return "";
    const diff = Date.now() - t;
    const m = Math.round(diff / 60000);
    if (m < 1) return "just now";
    if (m < 60) return `${m}m ago`;
    const h = Math.round(m / 60);
    if (h < 24) return `${h}h ago`;
    const d = Math.round(h / 24);
    if (d < 7) return `${d}d ago`;
    return new Date(iso).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    });
  } catch {
    return "";
  }
}

/**
 * Recent / live scrimmage matches block. Shown above the leaderboard so
 * spectators can dive into a match in progress in two clicks.
 */
export async function ScrimmageRecents({ limit = 6 }: { limit?: number }) {
  const matches = await getRecentScrimmageMatches(limit);
  if (matches.length === 0) return null;

  const liveCount = matches.filter((m) => m.status === "live").length;

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.32em] text-white/55">
            Recent &amp; Live
          </p>
          <h2 className="mt-1 text-xl font-semibold tracking-tight sm:text-2xl">
            Match logs
          </h2>
        </div>
        {liveCount > 0 ? (
          <Badge
            variant="outline"
            className="border-rose-400/45 bg-rose-500/15 text-rose-100"
          >
            <span className="relative mr-1 flex size-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-300 opacity-75" />
              <span className="relative inline-flex size-1.5 rounded-full bg-rose-300" />
            </span>
            {liveCount} live now
          </Badge>
        ) : null}
      </div>
      <div className="flex flex-col gap-2">
        {matches.map((m) => (
          <RecentRow key={m.matchCode} match={m} />
        ))}
      </div>
    </section>
  );
}

function RecentRow({ match }: { match: ScrimmageMatchSummary }) {
  const pill = statusPill(match.status);
  const t1 = match.team1Score;
  const t2 = match.team2Score;
  const showScore = match.status !== "live" && t1 != null && t2 != null;
  const isLive = match.status === "live";
  const linkedDot = match.isLinkedToRoblox ? (
    <span
      title="Linked to Roblox match"
      className="inline-flex items-center gap-1 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-emerald-200/95"
    >
      <Radio className="size-2.5" />
      Roblox
    </span>
  ) : null;

  return (
    <Link
      href={`/stats/faceit/${encodeURIComponent(match.matchCode)}`}
      className="block rounded-xl outline-none transition focus-visible:ring-2 focus-visible:ring-white/40"
    >
      <Card className="gap-0 py-0 transition hover:bg-white/[0.07] hover:ring-white/25">
        <div className="flex items-center gap-3 px-4 py-3 sm:gap-4">
          <Badge
            variant="outline"
            className={`shrink-0 ${pill.class} ${
              isLive ? "min-w-[3.25rem] justify-center" : ""
            }`}
          >
            {pill.live ? (
              <span className="relative mr-1 flex size-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-300 opacity-75" />
                <span className="relative inline-flex size-1.5 rounded-full bg-rose-300" />
              </span>
            ) : null}
            {pill.label}
          </Badge>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
              <p className="font-mono text-xs font-semibold text-white/85 sm:text-sm">
                {match.matchCode}
              </p>
              {linkedDot}
              <p className="text-[11px] text-white/55">
                {timeAgo(match.playedAt)}
                {match.playerCount
                  ? ` · ${match.playerCount}v${match.playerCount}`
                  : ""}
              </p>
            </div>
            <p className="mt-0.5 truncate text-xs text-white/75 sm:text-sm">
              <span className="font-semibold text-white">
                {match.team1CaptainName ?? "Team 1"}
              </span>
              <span className="mx-1.5 text-white/45">vs</span>
              <span className="font-semibold text-white">
                {match.team2CaptainName ?? "Team 2"}
              </span>
            </p>
          </div>

          <div className="shrink-0 text-right">
            {showScore ? (
              <p className="font-mono text-lg font-semibold tabular-nums text-white sm:text-xl">
                {t1}
                <span className="mx-1 text-white/45">·</span>
                {t2}
              </p>
            ) : isLive ? (
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-rose-200/95">
                in progress
              </p>
            ) : (
              <p className="text-[11px] uppercase tracking-[0.2em] text-white/45">
                awaiting result
              </p>
            )}
          </div>
        </div>
      </Card>
    </Link>
  );
}
