import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Trophy, Users, Video } from "lucide-react";

import { SiteNav } from "@/components/site-nav";
import {
  listApprovedCreatorsForDirectory,
  type ApprovedCreatorDirectoryRow,
} from "@/lib/creator-onboard/approved-creators-directory";
import { COUNTRIES } from "@/lib/creator-onboard/countries";
import { loadCreatorWebEnv } from "@/lib/creator-onboard/env-web";
import {
  buildRoadTo1MChallenge,
  formatChallengeRobux,
  formatPoolSharePercent,
  ROAD_TO_1M_PRIZE_POOL_ROBUX,
  ROAD_TO_1M_TARGET_VIEWS,
} from "@/lib/creator-onboard/road-to-1m";
import { stripAtHandle } from "@/lib/creator-onboard/validators";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "VF Create · Road to 1M",
  description:
    "VF Create challenge to 1M views — 50,000 Robux pool, Virtuoso sponsor prizes for top 3. Leaderboard updates as creators post.",
  openGraph: {
    title: "VF Create · Road to 1M",
    description:
      "Track the sprint to 1M views and see creator standings · Virtuoso · Robux pool.",
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
    <div className="min-h-dvh min-w-0 bg-zinc-100 text-zinc-900">
      <div className="relative mx-auto max-w-6xl px-4 pb-16 pt-4 sm:px-6 lg:px-8">
        <SiteNav />

        <header className="mt-8 space-y-4 sm:mt-10">
          {challenge.milestoneReached ? (
            <p className="text-sm text-blue-800">
              Community total reached one million tracked views / plays.
            </p>
          ) : null}
          <h1 className="text-3xl font-bold tracking-tight text-zinc-900 sm:text-4xl md:text-5xl">
            Road to 1M
          </h1>
          <p className="max-w-2xl text-base leading-relaxed text-zinc-600 sm:text-[17px]">
            Approved VF Create members add posts with{" "}
            <code className="rounded bg-zinc-200/80 px-1 py-0.5 text-sm text-zinc-800">
              /posted
            </code>{" "}
            on Discord. YouTube views and TikTok plays sync on the daily job
            (and when staff run{" "}
            <code className="rounded bg-zinc-200/80 px-1 py-0.5 text-sm text-zinc-800">
              /update-content
            </code>
            ). When the community hits{" "}
            <strong className="font-semibold text-zinc-900">1,000,000</strong>{" "}
            combined, the{" "}
            <strong className="font-semibold text-zinc-900">
              {formatChallengeRobux(ROAD_TO_1M_PRIZE_POOL_ROBUX)}
            </strong>{" "}
            pool is shared by view share (example: about{" "}
            <strong className="font-semibold text-zinc-900">
              {formatChallengeRobux(ROAD_TO_1M_PRIZE_POOL_ROBUX * 0.1)}
            </strong>{" "}
            at roughly 10% of the total). The top three on the board also qualify
            for{" "}
            <strong className="font-semibold text-zinc-900">
              Virtuoso-sponsored boots
            </strong>{" "}
            of their choice (staff confirm ties).
          </p>
        </header>

        {/* Community progress */}
        <section
          className="mt-8 rounded-xl border border-zinc-200 bg-white p-5 shadow-sm sm:p-7"
          aria-labelledby="progress-heading"
        >
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2
                id="progress-heading"
                className="text-lg font-semibold text-zinc-900"
              >
                Community progress
              </h2>
              <p className="mt-1 text-sm text-zinc-600">
                {formatTargetNumber(challenge.totalTrackedViews)} /{" "}
                {formatTargetNumber(ROAD_TO_1M_TARGET_VIEWS)} tracked views
                &amp; plays
                {showOverflow ? (
                  <span className="ml-1 text-zinc-500">
                    ({formatViewCount(challenge.totalTrackedViews)} total)
                  </span>
                ) : null}
              </p>
            </div>
            <div className="text-left sm:text-right">
              <p className="text-2xl font-bold tabular-nums text-zinc-900 sm:text-3xl">
                {challenge.progressPercent.toFixed(1)}%
              </p>
              <p className="text-xs text-zinc-500">of the 1M goal</p>
            </div>
          </div>

          <div
            className="mt-5 h-3 overflow-hidden rounded-full bg-zinc-200"
            role="progressbar"
            aria-valuenow={Math.round(
              Math.min(100, challenge.progressPercent),
            )}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Progress toward one million views"
          >
            <div
              className="h-full rounded-full bg-blue-600 transition-[width] duration-500 ease-out"
              style={{ width: `${Math.min(100, barWidthPercent)}%` }}
            />
          </div>
          <p className="mt-2 text-xs text-zinc-500">
            New links show 0 views until the next metrics sync.
          </p>
        </section>

        {/* Leaderboard — directly under progress */}
        <section id="leaderboard" className="mt-10 scroll-mt-24">
          <div className="flex flex-col gap-3 border-b border-zinc-200 pb-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold text-zinc-900 sm:text-2xl">
                Leaderboard
              </h2>
              <p className="mt-1 text-sm text-zinc-500">
                Sorted by total synced views / plays · updates on each page load
              </p>
            </div>
            <div className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-700 shadow-sm">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <Image
                src="/Robux_2019_Logo_white.svg.png"
                alt=""
                width={20}
                height={20}
                className="size-5 shrink-0 rounded invert"
              />
              <span>
                Pool:{" "}
                <strong className="font-semibold text-zinc-900">
                  {formatChallengeRobux(challenge.prizePoolRobux)}
                </strong>
              </span>
              <span className="text-zinc-300">|</span>
              <span className="rounded border border-violet-200 bg-violet-50 px-2 py-0.5 text-xs font-medium text-violet-900">
                Virtuoso sponsor · top 3
              </span>
            </div>
          </div>

          {challenge.leaderboard.length === 0 ? (
            <p className="mt-6 rounded-xl border border-dashed border-zinc-300 bg-white px-6 py-12 text-center text-sm text-zinc-600">
              No posts on the board yet. Approved creators: add a link with{" "}
              <code className="rounded bg-zinc-100 px-1 text-zinc-800">
                /posted
              </code>{" "}
              in Discord.
            </p>
          ) : (
            <div className="mt-6 space-y-3">
              {challenge.leaderboard.map((row) => {
                const country = countryLabel(row.country);
                const cRow = creatorById.get(row.id);
                const tt = stripAtHandle(cRow?.tiktok_handle ?? null);
                const yt = stripAtHandle(cRow?.youtube_handle ?? null);
                const virtuosoPick = row.rank <= 3 && row.totalViews > 0;

                return (
                  <article
                    key={row.id}
                    className={`overflow-hidden rounded-xl border bg-white shadow-sm ${
                      virtuosoPick
                        ? "border-blue-300 ring-1 ring-blue-100"
                        : "border-zinc-200"
                    }`}
                  >
                    <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:gap-5 sm:p-5">
                      <div className="flex shrink-0 items-center gap-3 sm:w-44">
                        <span
                          className={`flex size-10 items-center justify-center rounded-full text-sm font-bold tabular-nums ${
                            row.rank === 1
                              ? "bg-amber-100 text-amber-900"
                              : row.rank === 2
                                ? "bg-zinc-200 text-zinc-800"
                                : row.rank === 3
                                  ? "bg-orange-100 text-orange-900"
                                  : "bg-zinc-100 text-zinc-600"
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
                            className="size-12 rounded-full object-cover ring-1 ring-zinc-200"
                          />
                        ) : (
                          <div className="flex size-12 items-center justify-center rounded-full bg-zinc-200 text-lg font-semibold text-zinc-600">
                            {row.displayName.slice(0, 1).toUpperCase()}
                          </div>
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-zinc-900">
                          {row.displayName}
                        </p>
                        <p className="text-sm text-zinc-600">
                          {row.robloxUsername}
                          {country ? <> · {country}</> : null}
                        </p>
                        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
                          {tt ? (
                            <a
                              href={`https://www.tiktok.com/@${encodeURIComponent(tt)}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-700 underline-offset-2 hover:underline"
                            >
                              TikTok
                            </a>
                          ) : null}
                          {yt ? (
                            <a
                              href={`https://www.youtube.com/@${encodeURIComponent(yt)}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-700 underline-offset-2 hover:underline"
                            >
                              YouTube
                            </a>
                          ) : null}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6 lg:gap-3">
                        <div className="rounded-lg bg-zinc-50 px-3 py-2 ring-1 ring-zinc-100">
                          <p className="text-[11px] text-zinc-500">Views</p>
                          <p className="text-base font-semibold tabular-nums text-zinc-900">
                            {formatViewCount(row.totalViews)}
                          </p>
                        </div>
                        <div className="rounded-lg bg-zinc-50 px-3 py-2 ring-1 ring-zinc-100">
                          <p className="text-[11px] text-zinc-500">Posts</p>
                          <p className="text-base font-semibold tabular-nums text-zinc-900">
                            {row.postCount}
                          </p>
                        </div>
                        <div className="rounded-lg bg-zinc-50 px-3 py-2 ring-1 ring-zinc-100">
                          <p className="text-[11px] text-zinc-500">Pool share</p>
                          <p className="text-base font-semibold tabular-nums text-blue-800">
                            {formatPoolSharePercent(row.poolSharePercent)}
                          </p>
                        </div>
                        <div className="rounded-lg bg-zinc-50 px-3 py-2 ring-1 ring-zinc-100">
                          <p className="text-[11px] text-zinc-500">
                            Est. Robux
                          </p>
                          <p className="text-base font-semibold tabular-nums text-emerald-800">
                            {formatChallengeRobux(row.estimatedPayoutRobux)}
                          </p>
                        </div>
                        <div className="col-span-2 rounded-lg bg-zinc-50 px-3 py-2 ring-1 ring-zinc-100 lg:col-span-2">
                          <p className="text-[11px] text-zinc-500">
                            Virtuoso sponsor
                          </p>
                          {virtuosoPick ? (
                            <span className="mt-1 inline-flex items-center rounded-md border border-violet-300 bg-violet-50 px-2.5 py-1 text-xs font-medium text-violet-950">
                              Top {row.rank} · footwear pick
                            </span>
                          ) : (
                            <p className="mt-1 text-sm text-zinc-400">—</p>
                          )}
                        </div>
                      </div>
                    </div>

                    <details className="group border-t border-zinc-100 bg-zinc-50/80">
                      <summary className="cursor-pointer list-none px-4 py-2.5 text-sm text-blue-800 hover:underline sm:px-5">
                        View posts ({row.postCount})
                        <span className="text-zinc-400 group-open:hidden">
                          {" "}
                          · expand
                        </span>
                        <span className="hidden text-zinc-400 group-open:inline">
                          {" "}
                          · collapse
                        </span>
                      </summary>
                      <ul className="space-y-1 border-t border-zinc-200/80 px-4 pb-3 pt-2 sm:px-5">
                        {row.posts.map((p) => {
                          const dateLabel = formatPostedDate(p.posted_at);
                          const viewsLabel =
                            typeof p.view_count === "number"
                              ? formatViewCount(p.view_count)
                              : null;
                          return (
                            <li
                              key={`${row.id}-${p.posted_at}-${p.url}`}
                              className="flex flex-col gap-0.5 py-1.5 text-sm sm:flex-row sm:items-center sm:justify-between"
                            >
                              <a
                                href={p.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="font-medium text-blue-800 underline-offset-2 hover:underline"
                              >
                                {postHostLabel(p.url)}
                                {dateLabel ? (
                                  <span className="ml-2 text-xs font-normal text-zinc-500">
                                    {dateLabel}
                                  </span>
                                ) : null}
                              </a>
                              <span className="text-xs tabular-nums text-zinc-500">
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
                                  "Awaiting sync"
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

        {/* Quick stats */}
        <section className="mt-10 grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-2 text-zinc-600">
              <Video className="size-4" aria-hidden />
              <span className="text-sm font-medium text-zinc-700">
                Posts live
              </span>
            </div>
            <p className="mt-2 text-2xl font-bold tabular-nums text-zinc-900">
              {challenge.totalPostCount}
            </p>
            <p className="mt-0.5 text-xs text-zinc-500">
              {challenge.participantCount} creators with links
            </p>
          </div>
          <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-2 text-zinc-600">
              <Users className="size-4" aria-hidden />
              <span className="text-sm font-medium text-zinc-700">
                On leaderboard
              </span>
            </div>
            <p className="mt-2 text-2xl font-bold tabular-nums text-zinc-900">
              {challenge.leaderboard.length}
            </p>
            <p className="mt-0.5 text-xs text-zinc-500">
              At least one challenge post
            </p>
          </div>
          <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-2 text-zinc-600">
              <Trophy className="size-4" aria-hidden />
              <span className="text-sm font-medium text-zinc-700">
                Virtuoso top 3
              </span>
            </div>
            <p className="mt-2 text-sm font-semibold text-zinc-900">
              Sponsored boots
            </p>
            <p className="mt-0.5 text-xs text-zinc-500">
              Highest view totals (staff confirm)
            </p>
          </div>
        </section>

        <section
          id="how-it-works"
          className="mt-10 scroll-mt-24 rounded-xl border border-zinc-200 bg-white p-6 shadow-sm sm:p-7"
        >
          <h2 className="text-lg font-semibold text-zinc-900">
            How Robux and Virtuoso work
          </h2>
          <ul className="mt-4 space-y-3 text-sm leading-relaxed text-zinc-600">
            <li className="flex gap-3">
              <span className="tabular-nums text-zinc-400">1.</span>
              <span>
                Tracked{" "}
                <strong className="font-medium text-zinc-900">
                  YouTube views
                </strong>{" "}
                and{" "}
                <strong className="font-medium text-zinc-900">
                  TikTok plays
                </strong>{" "}
                come from links submitted with{" "}
                <code className="rounded bg-zinc-100 px-1">/posted</code>.
              </span>
            </li>
            <li className="flex gap-3">
              <span className="tabular-nums text-zinc-400">2.</span>
              <span>
                At{" "}
                <strong className="font-medium text-zinc-900">
                  1M combined
                </strong>{" "}
                tracked views/plays, the{" "}
                <strong className="font-medium text-zinc-900">
                  {formatChallengeRobux(ROAD_TO_1M_PRIZE_POOL_ROBUX)}
                </strong>{" "}
                pool is split{" "}
                <strong className="font-medium text-zinc-900">
                  in proportion
                </strong>{" "}
                to each creator&apos;s share of the total (same idea as 10% of
                views ≈{" "}
                {formatChallengeRobux(ROAD_TO_1M_PRIZE_POOL_ROBUX * 0.1)}).
              </span>
            </li>
            <li className="flex gap-3">
              <span className="tabular-nums text-zinc-400">3.</span>
              <span>
                The table above shows each creator&apos;s current share and
                estimated Robux; numbers move as more posts and syncs land.
              </span>
            </li>
            <li className="flex gap-3">
              <span className="tabular-nums text-zinc-400">4.</span>
              <span>
                <strong className="font-medium text-zinc-900">
                  Virtuoso sponsor
                </strong>{" "}
                rewards: top three finishers on views can choose Virtuoso
                footwear, in addition to pool math — final calls by VF staff.
              </span>
            </li>
          </ul>
        </section>

        <footer className="mt-14 border-t border-zinc-200 pt-8 text-center text-xs text-zinc-500 sm:text-sm">
          <p className="flex flex-wrap items-center justify-center gap-x-3 gap-y-2">
            <Link
              href="/"
              className="text-blue-800 underline-offset-2 hover:underline"
            >
              VF home
            </Link>
            <span>·</span>
            <Link
              href="/content/creators/onboard"
              className="text-blue-800 underline-offset-2 hover:underline"
            >
              Creator onboarding
            </Link>
            <span>·</span>
            <a
              href="#how-it-works"
              className="text-blue-800 underline-offset-2 hover:underline"
            >
              Rules
            </a>
          </p>
          <p className="mx-auto mt-3 max-w-xl text-[11px] leading-relaxed text-zinc-400">
            Numbers are indicative until VF staff confirm eligibility and
            payout. Official VF Create rules apply.
          </p>
        </footer>
      </div>
    </div>
  );
}
