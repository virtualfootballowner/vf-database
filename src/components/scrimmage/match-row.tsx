import Link from "next/link";

import type { ScrimmageRecentMatch } from "@/lib/scrimmage/queries";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

const OUTCOME_STYLES: Record<
  ScrimmageRecentMatch["outcome"],
  { label: string; chipClass: string }
> = {
  win: {
    label: "WIN",
    chipClass: "border-emerald-400/35 text-emerald-200/95 bg-emerald-400/10",
  },
  loss: {
    label: "LOSS",
    chipClass: "border-rose-400/35 text-rose-200/95 bg-rose-400/10",
  },
  draw: {
    label: "DRAW",
    chipClass: "border-amber-400/35 text-amber-200/95 bg-amber-400/10",
  },
  pending: {
    label: "PENDING",
    chipClass: "border-white/15 text-white/65 bg-white/5",
  },
};

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return "—";
  }
}

function signed(n: number | null): string {
  if (n == null) return "—";
  return n >= 0 ? `+${n}` : `${n}`;
}

/**
 * One row in the player's recent / full scrimmage history. Click-through
 * to /scrimmages/<matchCode>.
 */
export function ScrimmageMatchRow({
  match,
}: {
  match: ScrimmageRecentMatch;
}) {
  const style = OUTCOME_STYLES[match.outcome];
  const meTeamScore =
    match.team === 1 ? match.team1Score : match.team2Score;
  const oppTeamScore =
    match.team === 1 ? match.team2Score : match.team1Score;
  const oppCaptain =
    match.team === 1 ? match.team2CaptainName : match.team1CaptainName;
  const myCaptain =
    match.team === 1 ? match.team1CaptainName : match.team2CaptainName;
  const eloDelta = signed(match.eloChange);
  const deltaTone =
    match.eloChange == null
      ? "text-white/55"
      : match.eloChange > 0
        ? "text-emerald-300"
        : match.eloChange < 0
          ? "text-rose-300"
          : "text-white/65";

  return (
    <Link
      href={`/scrimmages/${encodeURIComponent(match.matchCode)}`}
      className="block rounded-xl outline-none transition focus-visible:ring-2 focus-visible:ring-white/40"
    >
      <Card className="gap-0 py-0 transition hover:bg-white/[0.07] hover:ring-white/25">
        <div className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:gap-4">
          <Badge
            variant="outline"
            className={`shrink-0 rounded px-2 py-0.5 font-semibold tracking-wider ${style.chipClass}`}
          >
            {style.label}
          </Badge>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-baseline gap-2">
              <p className="text-sm font-semibold tabular-nums text-white">
                <span className="text-white/85">
                  {meTeamScore ?? "—"}
                </span>
                <span className="mx-1 text-white/45">·</span>
                <span className="text-white/85">
                  {oppTeamScore ?? "—"}
                </span>
              </p>
              <p className="text-[11px] uppercase tracking-[0.18em] text-white/55">
                vs {oppCaptain ?? "Unknown"} (T{match.team === 1 ? 2 : 1})
              </p>
              {match.isCaptain ? (
                <Badge
                  variant="outline"
                  className="border-amber-300/35 bg-amber-300/10 text-[10px] font-semibold uppercase tracking-wider text-amber-100/95"
                >
                  Captain
                </Badge>
              ) : null}
              {match.isAfk ? (
                <Badge
                  variant="outline"
                  className="border-rose-400/35 bg-rose-400/10 text-[10px] font-semibold uppercase tracking-wider text-rose-200/95"
                >
                  AFK
                </Badge>
              ) : null}
            </div>
            <p className="mt-1 text-[11px] text-white/50">
              {match.matchCode} · {formatDate(match.playedAt)}
              {match.preferredPosition
                ? ` · played as ${match.preferredPosition}`
                : ""}
              {myCaptain && !match.isCaptain
                ? ` · captain: ${myCaptain}`
                : ""}
            </p>
          </div>

          <div className="shrink-0 sm:text-right">
            <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/45">
              ELO Δ
            </span>
            <p className={`mt-0.5 text-base font-semibold tabular-nums ${deltaTone}`}>
              {eloDelta}
            </p>
            <p className="text-[10px] tabular-nums text-white/45">
              {match.eloBefore} → {match.eloAfter ?? "—"}
            </p>
          </div>
        </div>
      </Card>
    </Link>
  );
}
