import {
  CircleDot,
  Flag,
  Hand,
  PlayCircle,
  Square,
  Star,
  Swords,
  Trophy,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  getScrimmageMatchEvents,
  type ScrimmageEvent,
} from "@/lib/scrimmage/queries";

type EventStyle = {
  Icon: LucideIcon;
  label: string;
  iconClass: string;
  bgClass: string;
};

const STYLES: Record<string, EventStyle> = {
  goal: {
    Icon: CircleDot,
    label: "GOAL",
    iconClass: "text-emerald-200",
    bgClass: "bg-emerald-400/15 ring-emerald-300/30",
  },
  own_goal: {
    Icon: CircleDot,
    label: "OWN GOAL",
    iconClass: "text-rose-200",
    bgClass: "bg-rose-400/15 ring-rose-300/30",
  },
  assist: {
    Icon: Hand,
    label: "ASSIST",
    iconClass: "text-cyan-200",
    bgClass: "bg-cyan-400/15 ring-cyan-300/30",
  },
  yellow_card: {
    Icon: Square,
    label: "YELLOW",
    iconClass: "text-amber-200",
    bgClass: "bg-amber-400/15 ring-amber-300/30",
  },
  red_card: {
    Icon: Square,
    label: "RED",
    iconClass: "text-rose-200",
    bgClass: "bg-rose-500/15 ring-rose-400/30",
  },
  motm: {
    Icon: Star,
    label: "MOTM",
    iconClass: "text-fuchsia-200",
    bgClass: "bg-fuchsia-400/15 ring-fuchsia-300/30",
  },
  save: {
    Icon: Hand,
    label: "SAVE",
    iconClass: "text-sky-200",
    bgClass: "bg-sky-400/15 ring-sky-300/30",
  },
  match_start: {
    Icon: PlayCircle,
    label: "MATCH START",
    iconClass: "text-emerald-200",
    bgClass: "bg-emerald-400/15 ring-emerald-300/30",
  },
  kickoff: {
    Icon: PlayCircle,
    label: "KICKOFF",
    iconClass: "text-white/85",
    bgClass: "bg-white/10 ring-white/20",
  },
  halftime: {
    Icon: Flag,
    label: "HALF-TIME",
    iconClass: "text-white/85",
    bgClass: "bg-white/10 ring-white/20",
  },
  fulltime: {
    Icon: Flag,
    label: "FULL-TIME",
    iconClass: "text-amber-200",
    bgClass: "bg-amber-400/15 ring-amber-300/30",
  },
  match_end: {
    Icon: Trophy,
    label: "MATCH END",
    iconClass: "text-amber-200",
    bgClass: "bg-amber-400/15 ring-amber-300/30",
  },
};

function styleFor(eventType: string): EventStyle {
  return (
    STYLES[eventType] ?? {
      Icon: Swords,
      label: eventType.replace(/_/g, " ").toUpperCase(),
      iconClass: "text-white/75",
      bgClass: "bg-white/10 ring-white/20",
    }
  );
}

function fmtMinute(minute: number | null): string {
  if (minute == null) return "—";
  return `${minute}'`;
}

/**
 * Server component — renders the live event log for a single scrim match.
 * Hidden when there are zero events (i.e. Roblox dev hasn't wired up yet
 * for this match). Title prefix changes when the match is still live.
 */
export async function ScrimmageEventTimeline({
  matchId,
  isLive,
}: {
  matchId: string;
  isLive: boolean;
}) {
  const events = await getScrimmageMatchEvents(matchId);
  if (events.length === 0) return null;

  const goalsByTeam = countGoals(events);

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.32em] text-white/55">
            {isLive ? "Live · Roblox" : "Match log · Roblox"}
          </p>
          <h2 className="mt-1 text-xl font-semibold tracking-tight sm:text-2xl">
            Event timeline
          </h2>
        </div>
        <div className="flex items-center gap-1.5 text-[11px] tabular-nums text-white/55">
          <Badge
            variant="outline"
            className="border-white/15 bg-white/5 text-white/85"
          >
            T1 {goalsByTeam[1]} · T2 {goalsByTeam[2]}
          </Badge>
        </div>
      </div>
      <Card className="gap-0 py-0">
        <ul className="flex flex-col">
          {events.map((ev, i) => (
            <EventRow key={ev.id} event={ev} isLast={i === events.length - 1} />
          ))}
        </ul>
      </Card>
    </section>
  );
}

function EventRow({
  event,
  isLast,
}: {
  event: ScrimmageEvent;
  isLast: boolean;
}) {
  const s = styleFor(event.eventType);
  const teamTag =
    event.team != null ? (
      <Badge
        variant="outline"
        className={`shrink-0 px-1.5 py-0 text-[9px] font-semibold uppercase tracking-wider ${
          event.team === 1
            ? "border-blue-300/35 bg-blue-400/10 text-blue-100"
            : "border-purple-300/35 bg-purple-400/10 text-purple-100"
        }`}
      >
        T{event.team}
      </Badge>
    ) : null;

  const actor = event.robloxUsername ? (
    <Link
      href={`/players/${encodeURIComponent(event.robloxUsername)}`}
      className="font-semibold text-white underline decoration-white/20 underline-offset-2 hover:decoration-white/60"
    >
      {event.robloxUsername}
    </Link>
  ) : (
    <span className="font-semibold text-white/75">
      Roblox #{event.robloxUserId}
    </span>
  );

  // Pull common detail bits: assister, opponent, etc.
  const assistBy =
    typeof event.details["assist_roblox_username"] === "string"
      ? (event.details["assist_roblox_username"] as string)
      : null;

  return (
    <li
      className={`flex items-center gap-3 px-4 py-2.5 ${
        isLast ? "" : "border-b border-white/5"
      }`}
    >
      <span className="w-9 shrink-0 text-center font-mono text-xs font-semibold tabular-nums text-white/55">
        {fmtMinute(event.minute)}
      </span>
      <span
        className={`flex size-7 shrink-0 items-center justify-center rounded-full ring-1 ${s.bgClass}`}
        aria-hidden
      >
        <s.Icon className={`size-3.5 ${s.iconClass}`} />
      </span>
      <span
        className={`shrink-0 text-[10px] font-bold uppercase tracking-[0.16em] ${s.iconClass}`}
      >
        {s.label}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          {teamTag}
          <p className="truncate text-sm text-white/85">
            {actor}
            {assistBy ? (
              <span className="text-white/55">
                {" "}
                · assist{" "}
                <Link
                  href={`/players/${encodeURIComponent(assistBy)}`}
                  className="text-white/85 underline decoration-white/20 underline-offset-2 hover:decoration-white/60"
                >
                  {assistBy}
                </Link>
              </span>
            ) : null}
          </p>
        </div>
      </div>
    </li>
  );
}

function countGoals(events: ScrimmageEvent[]): Record<1 | 2, number> {
  const out: Record<1 | 2, number> = { 1: 0, 2: 0 };
  for (const ev of events) {
    if (ev.eventType === "goal" && (ev.team === 1 || ev.team === 2)) {
      out[ev.team] += 1;
    } else if (
      ev.eventType === "own_goal" &&
      (ev.team === 1 || ev.team === 2)
    ) {
      // OG counts for the OPPOSITE team.
      const opp: 1 | 2 = ev.team === 1 ? 2 : 1;
      out[opp] += 1;
    }
  }
  return out;
}
