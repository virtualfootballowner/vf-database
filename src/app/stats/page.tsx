import Link from "next/link";

import { SiteNav } from "@/components/site-nav";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  getRobloxHeadshots,
  isVerifiedRobloxUserId,
  resolveRobloxUserIdsByUsernames,
} from "@/lib/roblox";
import { getLeaderboards, type LeaderEntry } from "@/lib/stats-leaders";
import { getSiteStatsBundle } from "@/lib/site-db";
import { cn } from "@/lib/utils";

import { StatsSectionNav } from "./stats-section-nav";

/** Leaderboards read Supabase at request time; avoid serving a stale build-time snapshot. */
export const dynamic = "force-dynamic";

function headshotUserId(
  r: LeaderEntry,
  resolved: Map<string, string>,
): string | null {
  if (isVerifiedRobloxUserId(r.roblox_user_id)) {
    return r.roblox_user_id;
  }
  return resolved.get(r.roblox_username.toLowerCase()) ?? null;
}

export default async function StatsPage() {
  const [boards, bundle] = await Promise.all([
    getLeaderboards(),
    getSiteStatsBundle(),
  ]);

  const combined = [...boards.goals, ...boards.assists];
  const needLookup = combined
    .filter((r) => !isVerifiedRobloxUserId(r.roblox_user_id))
    .map((r) => r.roblox_username);
  const resolved = await resolveRobloxUserIdsByUsernames(needLookup);

  const headshotIds = new Set<string>();
  for (const r of combined) {
    const id = headshotUserId(r, resolved);
    if (id) headshotIds.add(id);
  }
  const headshots = await getRobloxHeadshots([...headshotIds]);

  return (
    <main className="relative min-h-dvh min-w-0 w-full overflow-x-clip text-white">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 pb-16 pt-5 sm:px-6 sm:pt-8 md:px-8 md:pt-10">
        <SiteNav active="stats" />
        <StatsSectionNav />

        <section className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.32em] text-white/55">
              League data
            </p>
            <h1 className="mt-2 text-4xl font-semibold tracking-tight sm:text-5xl">
              Stats
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-white/70 sm:text-base">
              All-time leaders from every recorded match. Open a player for
              full history;               switch to{" "}
              <Link
                href="/stats/matches"
                className="font-semibold text-white underline decoration-white/35 underline-offset-4 hover:decoration-white/70"
              >
                All matches
              </Link>{" "}
              or{" "}
              <Link
                href="/stats/tournaments"
                className="font-semibold text-white underline decoration-white/35 underline-offset-4 hover:decoration-white/70"
              >
                Tournaments
              </Link>{" "}
              for tables and knockout overviews.
            </p>
          </div>
          <Badge
            variant="outline"
            className="border-white/15 bg-white/5 text-white/70"
          >
            Source · {boards.source === "supabase" ? "Database" : "Events file"}
          </Badge>
        </section>

        <section className="grid gap-6 lg:grid-cols-2">
          <LeaderCard
            title="Top goal scorers"
            subtitle="All-time top 10 · goals in recorded matches"
            rows={boards.goals}
            valueLabel="Goals"
            headshots={headshots}
            resolvedUserIds={resolved}
          />
          <LeaderCard
            title="Top assisters"
            subtitle="All-time top 10 · assists in recorded matches"
            rows={boards.assists}
            valueLabel="Assists"
            headshots={headshots}
            resolvedUserIds={resolved}
          />
        </section>

        <section className="grid gap-4 sm:grid-cols-2">
          <Link href="/stats/matches" className="block">
            <Card className="gap-0 py-0 transition hover:bg-white/[0.07] hover:ring-1 hover:ring-white/15">
              <CardContent className="flex flex-col gap-3 px-5 py-6 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-white/50">
                    Fixture archive
                  </p>
                  <h2 className="mt-2 text-xl font-semibold tracking-tight sm:text-2xl">
                    All matches
                  </h2>
                  <p className="mt-1 max-w-xl text-sm text-white/60">
                    {bundle.fixtureCounts.played} played ·{" "}
                    {bundle.fixtureCounts.total} slots ·{" "}
                    {bundle.fixtureCounts.missing} missing data
                  </p>
                </div>
                <span className="text-xs font-semibold uppercase tracking-[0.2em] text-white/55">
                  Open →
                </span>
              </CardContent>
            </Card>
          </Link>
          <Link href="/stats/tournaments" className="block">
            <Card className="gap-0 py-0 transition hover:bg-white/[0.07] hover:ring-1 hover:ring-white/15">
              <CardContent className="flex flex-col gap-3 px-5 py-6 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-white/50">
                    Structure
                  </p>
                  <h2 className="mt-2 text-xl font-semibold tracking-tight sm:text-2xl">
                    Tournaments
                  </h2>
                  <p className="mt-1 max-w-xl text-sm text-white/60">
                    League tables and knockout rails — S1 EuroLeague + playoffs,
                    S2 domestic tables, S3 World Cup path.
                  </p>
                </div>
                <span className="text-xs font-semibold uppercase tracking-[0.2em] text-white/55">
                  Open →
                </span>
              </CardContent>
            </Card>
          </Link>
        </section>
      </div>
    </main>
  );
}

function LeaderCard({
  title,
  subtitle,
  rows,
  valueLabel,
  headshots,
  resolvedUserIds,
}: {
  title: string;
  subtitle: string;
  rows: LeaderEntry[];
  valueLabel: string;
  headshots: Map<string, string>;
  resolvedUserIds: Map<string, string>;
}) {
  return (
    <Card className="gap-0 border-white/10 bg-white/[0.03] py-0">
      <CardHeader className="px-5 pb-2 pt-5">
        <CardTitle className="text-lg font-semibold text-white">
          {title}
        </CardTitle>
        <CardDescription className="text-white/55">{subtitle}</CardDescription>
      </CardHeader>
      <CardContent className="px-2 pb-4 pt-0 sm:px-4">
        {rows.length === 0 ? (
          <p className="px-3 py-6 text-sm text-white/45">No data yet.</p>
        ) : (
          <ul className="flex flex-col gap-0.5">
            {rows.map((r) => {
              const uid = headshotUserId(r, resolvedUserIds);
              const src = uid ? headshots.get(uid) : undefined;
              return (
                <li key={`${r.rank}-${r.roblox_username}`}>
                  <Link
                    href={`/players/${encodeURIComponent(r.roblox_username)}`}
                    className="flex items-center justify-between gap-3 rounded-lg px-3 py-2.5 outline-none transition hover:bg-white/[0.06] focus-visible:ring-2 focus-visible:ring-white/30"
                  >
                    <span className="flex min-w-0 flex-1 items-center gap-3">
                      <span className="w-6 shrink-0 text-center text-xs font-bold tabular-nums text-white/45">
                        {r.rank}
                      </span>
                      <LeaderAvatar src={src} name={r.roblox_username} />
                      <span className="truncate text-sm font-medium text-white/90">
                        {r.roblox_username}
                      </span>
                    </span>
                    <span className="shrink-0 text-sm font-bold tabular-nums text-white">
                      {r.total}{" "}
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-white/40">
                        {valueLabel}
                      </span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function LeaderAvatar({ src, name }: { src: string | undefined; name: string }) {
  const initials = name
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() || "?";

  if (src) {
    return (
      <img
        src={src}
        alt={`${name} avatar`}
        className="size-9 shrink-0 rounded-full object-cover ring-1 ring-white/15"
      />
    );
  }

  return (
    <div
      className={cn(
        "flex size-9 shrink-0 items-center justify-center rounded-full bg-white/[0.07] text-[10px] font-semibold text-white/60 ring-1 ring-white/10",
      )}
      aria-hidden
    >
      {initials}
    </div>
  );
}
