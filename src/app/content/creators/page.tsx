import type { Metadata } from "next";
import Link from "next/link";
import { Medal, Sparkles, TrendingUp, Trophy, Users, Video } from "lucide-react";

import { SiteNav } from "@/components/site-nav";
import {
  listApprovedCreatorsForDirectory,
  type ApprovedCreatorDirectoryRow,
} from "@/lib/creator-onboard/approved-creators-directory";
import { COUNTRIES } from "@/lib/creator-onboard/countries";
import { loadCreatorWebEnv } from "@/lib/creator-onboard/env-web";
import {
  buildRoadTo1MChallenge,
  formatChallengeUsd,
  formatPoolSharePercent,
  ROAD_TO_1M_PRIZE_POOL_USD,
  ROAD_TO_1M_TARGET_VIEWS,
} from "@/lib/creator-onboard/road-to-1m";
import { stripAtHandle } from "@/lib/creator-onboard/validators";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "VF Create · Road to 1M",
  description:
    "Live VF Create challenge — 1M views, $5,000 prize pool, top 3 win Virtuoso sponsorship. Leaderboard updates as creators post.",
  openGraph: {
    title: "VF Create · Road to 1M",
    description:
      "Track the community sprint to 1M views and see live creator standings.",
  },
  robots: { index: true, follow: true },
};

function countryLabel(code: string | null): string | null {
  if (!code?.trim()) return null;
  const hit = COUNTRIES.find((c) => c.code === code.toUpperCase().trim());
  return hit?.name ?? code;
}

function postHostLabel(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "Link";
  }
}

function formatPostedDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatViewCount(n: number): string {
  if (n < 1000) return String(n);
  if (n < 1_000_000)
    return `${(n / 1000).toFixed(n >= 10_000 ? 0 : 1)}K`;
  if (n < 1_000_000_000)
    return `${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1)}M`;
  return `${(n / 1_000_000_000).toFixed(1)}B`;
}

function formatTargetNumber(n: number): string {
  return new Intl.NumberFormat(undefined).format(n);
}

export default async function CreatorsChallengePage() {
  let creators: ApprovedCreatorDirectoryRow[] = [];
  try {
    const env = loadCreatorWebEnv();
    creators = await listApprovedCreatorsForDirectory(env);
  } catch {
    creators = [];
  }

  const challenge = buildRoadTo1MChallenge(creators);
  const creatorById = new Map(creators.map((c) => [c.id, c]));
  const barWidthPercent =
    challenge.totalTrackedViews === 0
      ? 0
      : Math.max(
          challenge.progressPercent,
          challenge.progressPercent < 0.25 ? 0.35 : challenge.progressPercent,
        );
  const showOverflow =
    challenge.totalTrackedViews > ROAD_TO_1M_TARGET_VIEWS;

  return (
    <div className="min-h-dvh min-w-0 bg-[#050b18] text-white">
      <div className="relative isolate overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_120%_80%_at_50%_-20%,rgba(56,189,248,0.22),transparent_55%),radial-gradient(ellipse_80%_50%_at_100%_50%,rgba(59,130,246,0.12),transparent_50%)]"
        />
        <div className="relative mx-auto max-w-6xl px-4 pb-20 pt-4 sm:px-6 lg:px-8">
          <SiteNav />

          <header className="mt-10 space-y-6 sm:mt-14">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-sky-400/35 bg-sky-500/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-sky-200/90 sm:text-xs">
                VF Create · Live tracker
              </span>
              {challenge.milestoneReached ? (
                <span className="rounded-full border border-amber-400/40 bg-amber-500/15 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-100 sm:text-xs">
                  1M unlocked
                </span>
              ) : null}
            </div>
            <h1 className="max-w-4xl text-4xl font-bold leading-[1.05] tracking-tight sm:text-5xl md:text-6xl">
              <span className="bg-gradient-to-r from-white via-sky-100 to-cyan-200 bg-clip-text text-transparent">
                Road to 1M
              </span>
            </h1>
            <p className="max-w-2xl text-base leading-relaxed text-slate-300 sm:text-lg">
              Every approved creator adds posts with{" "}
              <span className="font-mono text-sm text-sky-200/90">/posted</span>{" "}
              on Discord. We pull live YouTube views and TikTok plays daily
              (and when staff run{" "}
              <span className="font-mono text-sm text-sky-200/90">
                /update-content
              </span>
              ). Hit <strong className="text-white">one million</strong>{" "}
              combined — then the{" "}
              <strong className="text-white">
                {formatChallengeUsd(ROAD_TO_1M_PRIZE_POOL_USD)}
              </strong>{" "}
              pool pays out by share of views.{" "}
              <strong className="text-white">Top 3</strong> on the board also
              earn <strong className="text-white">Virtuoso-sponsored shoes</strong>{" "}
              of their choice.
            </p>
          </header>

          {/* Progress */}
          <section
            className="mt-12 rounded-2xl border border-white/10 bg-white/[0.04] p-5 shadow-[0_0_0_1px_rgba(255,255,255,0.04)_inset] backdrop-blur-sm sm:p-8"
            aria-labelledby="progress-heading"
          >
            <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2
                  id="progress-heading"
                  className="text-lg font-semibold text-white sm:text-xl"
                >
                  Community progress
                </h2>
                <p className="mt-1 text-sm text-slate-400">
                  {formatTargetNumber(challenge.totalTrackedViews)} /{" "}
                  {formatTargetNumber(ROAD_TO_1M_TARGET_VIEWS)} tracked views
                  &amp; plays
                  {showOverflow ? (
                    <span className="ml-1 text-sky-300">
                      ({formatViewCount(challenge.totalTrackedViews)} total)
                    </span>
                  ) : null}
                </p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold tabular-nums text-white sm:text-3xl">
                  {challenge.progressPercent.toFixed(2)}%
                </p>
                <p className="text-xs text-slate-500">of 1M milestone</p>
              </div>
            </div>

            <div
              className="mt-6 h-4 overflow-hidden rounded-full bg-slate-800/80 ring-1 ring-white/10"
              role="progressbar"
              aria-valuenow={Math.round(
                Math.min(100, challenge.progressPercent),
              )}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Progress toward one million views"
            >
              <div
                className="h-full rounded-full bg-gradient-to-r from-sky-500 via-blue-400 to-cyan-300 shadow-[0_0_20px_rgba(56,189,248,0.35)] transition-[width] duration-700 ease-out"
                style={{
                  width: `${Math.min(100, barWidthPercent)}%`,
                }}
              />
            </div>
            <p className="mt-3 text-xs leading-relaxed text-slate-500">
              Bar fills as synced metrics add up. New links start at 0 until
              the next Apify sync.
            </p>
          </section>

          {/* Stat cards */}
          <section className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
              <div className="flex items-center gap-2 text-sky-300">
                <TrendingUp className="size-4 shrink-0" aria-hidden />
                <span className="text-xs font-medium uppercase tracking-wider text-slate-400">
                  Prize pool
                </span>
              </div>
              <p className="mt-2 text-2xl font-bold tabular-nums">
                {formatChallengeUsd(ROAD_TO_1M_PRIZE_POOL_USD)}
              </p>
              <p className="mt-1 text-xs text-slate-500">Split by view share</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
              <div className="flex items-center gap-2 text-sky-300">
                <Video className="size-4 shrink-0" aria-hidden />
                <span className="text-xs font-medium uppercase tracking-wider text-slate-400">
                  Posts live
                </span>
              </div>
              <p className="mt-2 text-2xl font-bold tabular-nums">
                {challenge.totalPostCount}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Across {challenge.participantCount} creators
              </p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
              <div className="flex items-center gap-2 text-sky-300">
                <Users className="size-4 shrink-0" aria-hidden />
                <span className="text-xs font-medium uppercase tracking-wider text-slate-400">
                  On leaderboard
                </span>
              </div>
              <p className="mt-2 text-2xl font-bold tabular-nums">
                {challenge.leaderboard.length}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Creators with at least one post
              </p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
              <div className="flex items-center gap-2 text-amber-300/90">
                <Trophy className="size-4 shrink-0" aria-hidden />
                <span className="text-xs font-medium uppercase tracking-wider text-slate-400">
                  Virtuoso top 3
                </span>
              </div>
              <p className="mt-2 text-sm font-semibold leading-snug text-white">
                Sponsored cleats
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Highest tracked views · picks of their choice
              </p>
            </div>
          </section>

          {/* How it works */}
          <section
            id="how-it-works"
            className="mt-14 scroll-mt-24 rounded-2xl border border-white/10 bg-slate-900/40 p-6 sm:p-8"
          >
            <h2 className="text-lg font-semibold text-white sm:text-xl">
              How payouts work
            </h2>
            <ul className="mt-4 space-y-3 text-sm leading-relaxed text-slate-300">
              <li className="flex gap-3">
                <span className="mt-0.5 font-mono text-sky-400">1.</span>
                <span>
                  We add up <strong className="text-white">YouTube views</strong>{" "}
                  and <strong className="text-white">TikTok plays</strong> from
                  every link creators submit with{" "}
                  <span className="font-mono text-sky-200/80">/posted</span>.
                </span>
              </li>
              <li className="flex gap-3">
                <span className="mt-0.5 font-mono text-sky-400">2.</span>
                <span>
                  The community bar hits <strong className="text-white">1M</strong>{" "}
                  when those numbers sum to one million — then the{" "}
                  {formatChallengeUsd(ROAD_TO_1M_PRIZE_POOL_USD)} pool is
                  allocated <strong className="text-white">proportionally</strong>
                  : e.g. <strong className="text-white">10%</strong> of total
                  tracked views → <strong className="text-white">10%</strong> of
                  the pool (about{" "}
                  {formatChallengeUsd(ROAD_TO_1M_PRIZE_POOL_USD * 0.1)} at that
                  split).
                </span>
              </li>
              <li className="flex gap-3">
                <span className="mt-0.5 font-mono text-sky-400">3.</span>
                <span>
                  The <strong className="text-white">leaderboard</strong> below
                  is sorted by total tracked views and shows each creator’s{" "}
                  <strong className="text-white">live pool %</strong> and{" "}
                  <strong className="text-white">estimated $</strong> using the
                  same math (updates automatically when metrics sync).
                </span>
              </li>
              <li className="flex gap-3">
                <span className="mt-0.5 font-mono text-sky-400">4.</span>
                <span>
                  <strong className="text-white">Top 3</strong> earn{" "}
                  <strong className="text-white">Virtuoso</strong> sponsored
                  footwear on top of pool eligibility — ties follow staff rules.
                </span>
              </li>
            </ul>
          </section>

          {/* Leaderboard */}
          <section id="leaderboard" className="mt-14 scroll-mt-24">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <h2 className="text-xl font-semibold text-white sm:text-2xl">
                Live leaderboard
              </h2>
              <p className="text-xs text-slate-500">
                Totals = sum of synced views/plays per creator · refreshes with
                each site load &amp; sync
              </p>
            </div>

            {challenge.leaderboard.length === 0 ? (
              <p className="mt-6 rounded-xl border border-dashed border-white/15 bg-white/[0.02] px-6 py-14 text-center text-sm text-slate-400">
                No challenge posts yet. Approved creators: add links with{" "}
                <span className="font-mono text-sky-300">/posted</span> in
                Discord, then metrics will appear after the next sync.
              </p>
            ) : (
              <div className="mt-6 space-y-4">
                {challenge.leaderboard.map((row) => {
                  const country = countryLabel(row.country);
                  const cRow = creatorById.get(row.id);
                  const tt = stripAtHandle(cRow?.tiktok_handle ?? null);
                  const yt = stripAtHandle(cRow?.youtube_handle ?? null);
                  const topThree = row.rank <= 3 && row.totalViews > 0;

                  return (
                    <article
                      key={row.id}
                      className={`overflow-hidden rounded-2xl border transition-colors ${
                        topThree
                          ? "border-amber-400/35 bg-gradient-to-br from-amber-500/[0.08] to-transparent ring-1 ring-amber-400/20"
                          : "border-white/10 bg-white/[0.03]"
                      }`}
                    >
                      <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:gap-6 sm:p-5">
                        <div className="flex shrink-0 items-center gap-3 sm:w-40">
                          <span
                            className={`flex size-10 items-center justify-center rounded-full text-sm font-bold tabular-nums ${
                              row.rank === 1
                                ? "bg-amber-400/25 text-amber-100"
                                : row.rank === 2
                                  ? "bg-slate-300/20 text-slate-100"
                                  : row.rank === 3
                                    ? "bg-amber-700/30 text-amber-50"
                                    : "bg-slate-800 text-slate-300"
                            }`}
                          >
                            {row.rank}
                          </span>
                          {row.robloxAvatarUrl ? (
                            /* eslint-disable-next-line @next/next/no-img-element */
                            <img
                              src={row.robloxAvatarUrl}
                              alt=""
                              width={48}
                              height={48}
                              className="size-12 rounded-full object-cover ring-2 ring-white/10"
                            />
                          ) : (
                            <div className="flex size-12 items-center justify-center rounded-full bg-slate-800 text-lg font-semibold text-slate-300">
                              {row.displayName.slice(0, 1).toUpperCase()}
                            </div>
                          )}
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                            <p className="font-semibold text-white">
                              {row.displayName}
                            </p>
                            {topThree ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-100">
                                <Medal className="size-3" aria-hidden />
                                Top 3 · Virtuoso
                              </span>
                            ) : null}
                          </div>
                          <p className="text-sm text-slate-400">
                            Roblox:{" "}
                            <span className="text-slate-200">
                              {row.robloxUsername}
                            </span>
                            {country ? (
                              <>
                                {" · "}
                                {country}
                              </>
                            ) : null}
                          </p>
                          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs">
                            {tt ? (
                              <a
                                href={`https://www.tiktok.com/@${encodeURIComponent(tt)}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-sky-300 underline-offset-2 hover:underline"
                              >
                                TikTok
                              </a>
                            ) : null}
                            {yt ? (
                              <a
                                href={`https://www.youtube.com/@${encodeURIComponent(yt)}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-sky-300 underline-offset-2 hover:underline"
                              >
                                YouTube
                              </a>
                            ) : null}
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4 lg:min-w-[28rem]">
                          <div className="rounded-lg bg-black/20 px-3 py-2 text-center sm:text-left">
                            <p className="text-[10px] font-medium uppercase tracking-wider text-slate-500">
                              Views
                            </p>
                            <p className="text-lg font-bold tabular-nums text-white">
                              {formatViewCount(row.totalViews)}
                            </p>
                          </div>
                          <div className="rounded-lg bg-black/20 px-3 py-2 text-center sm:text-left">
                            <p className="text-[10px] font-medium uppercase tracking-wider text-slate-500">
                              Posts
                            </p>
                            <p className="text-lg font-bold tabular-nums text-white">
                              {row.postCount}
                            </p>
                          </div>
                          <div className="rounded-lg bg-black/20 px-3 py-2 text-center sm:text-left">
                            <p className="text-[10px] font-medium uppercase tracking-wider text-slate-500">
                              Pool %
                            </p>
                            <p className="text-lg font-bold tabular-nums text-sky-200">
                              {formatPoolSharePercent(row.poolSharePercent)}
                            </p>
                          </div>
                          <div className="rounded-lg bg-black/20 px-3 py-2 text-center sm:text-left">
                            <p className="text-[10px] font-medium uppercase tracking-wider text-slate-500">
                              Est. payout
                            </p>
                            <p className="text-lg font-bold tabular-nums text-emerald-300">
                              {formatChallengeUsd(row.estimatedPayoutUsd)}
                            </p>
                          </div>
                        </div>
                      </div>

                      <details className="group border-t border-white/10 bg-black/15">
                        <summary className="cursor-pointer list-none px-4 py-3 text-sm text-sky-300/90 transition hover:text-sky-200 sm:px-5">
                          <span className="inline-flex items-center gap-2">
                            <Sparkles className="size-4" aria-hidden />
                            Posts &amp; per-link metrics ({row.postCount})
                            <span className="text-slate-500 group-open:hidden">
                              — show
                            </span>
                            <span className="hidden text-slate-500 group-open:inline">
                              — hide
                            </span>
                          </span>
                        </summary>
                        <ul className="space-y-2 border-t border-white/5 px-4 pb-4 pt-2 sm:px-5">
                          {row.posts.map((p) => {
                            const dateLabel = formatPostedDate(p.posted_at);
                            const viewsLabel =
                              typeof p.view_count === "number"
                                ? formatViewCount(p.view_count)
                                : null;
                            return (
                              <li
                                key={`${row.id}-${p.posted_at}-${p.url}`}
                                className="flex flex-col gap-0.5 rounded-lg py-2 text-sm sm:flex-row sm:items-center sm:justify-between"
                              >
                                <a
                                  href={p.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="font-medium text-sky-200 underline-offset-2 hover:underline"
                                >
                                  {postHostLabel(p.url)}
                                  {dateLabel ? (
                                    <span className="ml-2 text-xs font-normal text-slate-500">
                                      {dateLabel}
                                    </span>
                                  ) : null}
                                </a>
                                <span className="text-xs tabular-nums text-slate-400">
                                  {viewsLabel ? (
                                    <>
                                      {p.views_source === "tiktok"
                                        ? `${viewsLabel} plays`
                                        : `${viewsLabel} views`}
                                      {p.views_fetched_at ? (
                                        <>
                                          {" "}
                                          · sync{" "}
                                          {formatPostedDate(p.views_fetched_at)}
                                        </>
                                      ) : null}
                                    </>
                                  ) : (
                                    <span className="text-slate-600">
                                      Pending sync…
                                    </span>
                                  )}
                                </span>
                              </li>
                            );
                          })}
                        </ul>
                      </details>
                    </article>
                  );
                })}
              </div>
            )}
          </section>

          <footer className="mt-20 border-t border-white/10 pt-10 text-center text-xs text-slate-500 sm:text-sm">
            <p className="flex flex-wrap items-center justify-center gap-x-3 gap-y-2">
              <Link
                href="/"
                className="text-sky-400/90 underline-offset-2 hover:underline"
              >
                VF home
              </Link>
              <span className="text-slate-700">·</span>
              <Link
                href="/content/creators/onboard"
                className="text-sky-400/90 underline-offset-2 hover:underline"
              >
                Creator onboarding
              </Link>
              <span className="text-slate-700">·</span>
              <a
                href="#how-it-works"
                className="text-sky-400/90 underline-offset-2 hover:underline"
              >
                How it works
              </a>
            </p>
            <p className="mt-3 max-w-xl mx-auto text-[11px] leading-relaxed text-slate-600">
              Figures are informational until staff confirm final eligibility and
              payout. Official VF Create rules apply.
            </p>
          </footer>
        </div>
      </div>
    </div>
  );
}