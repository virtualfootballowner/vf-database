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
    <div className="relative min-h-dvh min-w-0 overflow-hidden text-white">
      {/* Hero glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[520px]"
        style={{
          backgroundImage:
            "radial-gradient(ellipse 70% 60% at 50% 18%, rgba(140,180,255,0.22) 0%, rgba(140,180,255,0) 70%)",
        }}
      />
      {/* Mid-page blue accent */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-[700px] h-[640px]"
        style={{
          backgroundImage:
            "radial-gradient(ellipse 60% 50% at 15% 40%, rgba(70,120,220,0.22) 0%, rgba(70,120,220,0) 70%), radial-gradient(ellipse 55% 50% at 85% 70%, rgba(120,90,220,0.18) 0%, rgba(120,90,220,0) 70%)",
        }}
      />
      {/* Lower warm accent */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 h-[700px]"
        style={{
          backgroundImage:
            "radial-gradient(ellipse 80% 60% at 50% 100%, rgba(255,140,80,0.10) 0%, rgba(255,140,80,0) 60%), radial-gradient(ellipse 50% 40% at 80% 95%, rgba(80,160,255,0.14) 0%, rgba(80,160,255,0) 70%)",
        }}
      />

      <div className="relative mx-auto max-w-6xl px-4 pt-4 pb-16 sm:px-6 lg:px-8">
        <div>
          <SiteNav />

          <header className="mt-8 space-y-4 pb-6 sm:mt-10 sm:pb-10">
            {challenge.milestoneReached ? (
              <p className="text-sm font-medium text-emerald-200">
                Community total reached one million tracked views / plays.
              </p>
            ) : null}
            <p className="text-[10px] font-semibold uppercase tracking-[0.32em] text-white/55">
              VF Create
            </p>
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl">
              Road to 1M
            </h1>
            <p className="max-w-2xl text-base leading-relaxed text-white/85 sm:text-[17px]">
              Approved VF Create members add posts with{" "}
              <code className="rounded bg-white/15 px-1 py-0.5 text-sm text-white">
                /posted
              </code>{" "}
              on Discord. YouTube views and TikTok plays sync on the daily job
              (and when staff run{" "}
              <code className="rounded bg-white/15 px-1 py-0.5 text-sm text-white">
                /update-content
              </code>
              ). When the community hits{" "}
              <strong className="font-semibold text-white">1,000,000</strong>{" "}
              combined, the{" "}
              <strong className="font-semibold text-white">
                {formatChallengeRobux(ROAD_TO_1M_PRIZE_POOL_ROBUX)}
              </strong>{" "}
              pool is shared by view share (example: about{" "}
              <strong className="font-semibold text-white">
                {formatChallengeRobux(ROAD_TO_1M_PRIZE_POOL_ROBUX * 0.1)}
              </strong>{" "}
              at roughly 10% of the total). The top three on the board also
              qualify for{" "}
              <strong className="font-semibold text-white">
                Virtuoso-sponsored boots
              </strong>{" "}
              of their choice (staff confirm ties).
            </p>
          </header>
        </div>

        <div>
        {/* Community progress */}
        <section
          className="mt-8 rounded-xl border border-zinc-300/70 bg-zinc-100 p-5 shadow-[0_18px_40px_-20px_rgba(0,0,0,0.45)] sm:p-7"
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
                {formatTargetNumber(ROAD_TO_1M_TARGET_VIEWS)}
                {" "}tracked views &amp; plays
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
          <div className="flex flex-col gap-3 border-b border-white/15 pb-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold text-white sm:text-2xl">
                Leaderboard
              </h2>
              <p className="mt-1 text-sm text-white/65">
                Sorted by total synced views / plays · updates on each page load
              </p>
            </div>
            <div className="flex flex-col gap-1.5 sm:items-end">
              <div className="flex flex-wrap items-center gap-2 rounded-lg border border-white/15 bg-white/10 px-3 py-2 text-sm text-white/85 shadow-sm backdrop-blur">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <Image
                  src="/Robux_2019_Logo_white.svg.png"
                  alt=""
                  width={20}
                  height={20}
                  className="size-5 shrink-0 rounded"
                />
                <span>
                  Pool:{" "}
                  <strong className="font-semibold text-white">
                    {formatChallengeRobux(challenge.prizePoolRobux)}
                  </strong>
                </span>
                <span className="hidden text-white/30 sm:inline">|</span>
                <span className="rounded border border-violet-300/40 bg-violet-400/15 px-2 py-0.5 text-xs font-medium text-violet-100">
                  Virtuoso sponsor · top 3
                </span>
              </div>
              <Link
                href="/content/creators/virtuoso"
                className="text-xs font-medium text-blue-200 underline-offset-2 hover:text-white hover:underline sm:text-right"
              >
                What is this?
              </Link>
            </div>
          </div>

          {challenge.leaderboard.length === 0 ? (
            <p className="mt-6 rounded-xl border border-dashed border-white/25 bg-zinc-100 px-6 py-12 text-center text-sm text-zinc-700 shadow-[0_18px_40px_-20px_rgba(0,0,0,0.45)]">
              No posts on the board yet. Approved creators: add a link with{" "}
              <code className="rounded bg-white px-1 text-zinc-800">
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
                    className={`overflow-hidden rounded-xl border bg-zinc-100 shadow-[0_18px_40px_-20px_rgba(0,0,0,0.45)] ${
                      virtuosoPick
                        ? "border-blue-300/70 ring-1 ring-blue-200/50"
                        : "border-zinc-300/70"
                    }`}
                  >
                    <div className="flex flex-col gap-4 p-4 sm:p-5">
                      <div className="flex items-start gap-3">
                        <div className="flex shrink-0 items-center gap-3">
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
                      </div>

                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                        <div className="min-w-0 rounded-lg bg-white px-3 py-2 ring-1 ring-zinc-200">
                          <p className="text-[11px] text-zinc-500">Views</p>
                          <p className="truncate text-base font-semibold tabular-nums text-zinc-900">
                            {formatViewCount(row.totalViews)}
                          </p>
                        </div>
                        <div className="min-w-0 rounded-lg bg-white px-3 py-2 ring-1 ring-zinc-200">
                          <p className="text-[11px] text-zinc-500">Posts</p>
                          <p className="text-base font-semibold tabular-nums text-zinc-900">
                            {row.postCount}
                          </p>
                        </div>
                        <div className="min-w-0 rounded-lg bg-white px-3 py-2 ring-1 ring-zinc-200">
                          <p className="text-[11px] text-zinc-500">Pool share</p>
                          <p className="truncate text-base font-semibold tabular-nums text-blue-800">
                            {formatPoolSharePercent(row.poolSharePercent)}
                          </p>
                        </div>
                        <div className="min-w-0 rounded-lg bg-white px-3 py-2 ring-1 ring-zinc-200">
                          <p className="text-[11px] text-zinc-500">
                            Est. Robux
                          </p>
                          <p className="truncate text-base font-semibold tabular-nums text-emerald-800">
                            {formatChallengeRobux(row.estimatedPayoutRobux)}
                          </p>
                        </div>
                      </div>

                      <div className="rounded-lg bg-white px-3 py-2 ring-1 ring-zinc-200">
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

                    <details className="group border-t border-zinc-200 bg-zinc-200/60">
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
                      <ul className="space-y-1 border-t border-zinc-300/70 px-4 pb-3 pt-2 sm:px-5">
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
          <div className="rounded-xl border border-zinc-300/70 bg-zinc-100 p-4 shadow-[0_18px_40px_-20px_rgba(0,0,0,0.45)]">
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
          <div className="rounded-xl border border-zinc-300/70 bg-zinc-100 p-4 shadow-[0_18px_40px_-20px_rgba(0,0,0,0.45)]">
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
          <div className="rounded-xl border border-zinc-300/70 bg-zinc-100 p-4 shadow-[0_18px_40px_-20px_rgba(0,0,0,0.45)]">
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
          className="mt-10 scroll-mt-24 rounded-xl border border-zinc-300/70 bg-zinc-100 p-6 shadow-[0_18px_40px_-20px_rgba(0,0,0,0.45)] sm:p-8"
        >
          <div className="space-y-1">
            <p className="text-[10px] font-semibold uppercase tracking-[0.32em] text-zinc-500">
              New here? Start here
            </p>
            <h2 className="text-xl font-bold tracking-tight text-zinc-900 sm:text-2xl">
              VF Create · the full beginner guide
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-zinc-600 sm:text-[15px]">
              VF Create is the Virtual Football content program. You make
              short videos about VF — clips, montages, reactions, guides — post
              them on TikTok and/or YouTube, then log the link with our Discord
              bot. The community is racing to{" "}
              <strong className="text-zinc-900">1,000,000 combined views</strong>{" "}
              and unlocking a{" "}
              <strong className="text-zinc-900">
                {formatChallengeRobux(ROAD_TO_1M_PRIZE_POOL_ROBUX)} Robux
              </strong>{" "}
              pool. No prior experience required — this guide walks you through
              every step.
            </p>
          </div>

          <ol className="mt-6 space-y-5 text-sm leading-relaxed text-zinc-700 sm:text-[15px]">
            <li className="flex gap-3">
              <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">
                1
              </span>
              <div>
                <p className="font-semibold text-zinc-900">
                  Get approved as a VF Creator
                </p>
                <p className="mt-1 text-zinc-600">
                  Apply through{" "}
                  <Link
                    href="/content/creators/onboard"
                    className="font-medium text-blue-800 underline-offset-2 hover:underline"
                  >
                    Creator onboarding
                  </Link>
                  . You&apos;ll link your Discord, your Roblox account, and
                  drop your TikTok / YouTube handle so we know who&apos;s
                  posting. Staff review and approve — once you&apos;re in,
                  you get the{" "}
                  <strong className="text-zinc-900">Creator</strong> role on
                  Discord and unlock the{" "}
                  <code className="rounded bg-white px-1 py-0.5 text-[12px] text-zinc-800 ring-1 ring-zinc-200">
                    /posted
                  </code>{" "}
                  command.
                </p>
              </div>
            </li>

            <li className="flex gap-3">
              <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">
                2
              </span>
              <div>
                <p className="font-semibold text-zinc-900">
                  Make a VF video and post it publicly
                </p>
                <p className="mt-1 text-zinc-600">
                  Anything VF-themed counts — gameplay clips, match
                  highlights, edits, tutorials, reactions, comedy. Upload it
                  to your{" "}
                  <strong className="text-zinc-900">TikTok</strong> or{" "}
                  <strong className="text-zinc-900">YouTube</strong> channel
                  (the same one you registered during onboarding). Make sure
                  the post is public so we can read view / play counts.
                </p>
              </div>
            </li>

            <li className="flex gap-3">
              <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">
                3
              </span>
              <div>
                <p className="font-semibold text-zinc-900">
                  Log it with{" "}
                  <code className="rounded bg-white px-1 py-0.5 text-[13px] text-zinc-800 ring-1 ring-zinc-200">
                    /posted
                  </code>{" "}
                  on Discord
                </p>
                <p className="mt-1 text-zinc-600">
                  In any channel the bot can see, type{" "}
                  <code className="rounded bg-white px-1 py-0.5 text-[12px] text-zinc-800 ring-1 ring-zinc-200">
                    /posted url:&lt;your link&gt;
                  </code>{" "}
                  and paste the full URL of the video. The bot saves it
                  against your creator profile and adds it to the
                  leaderboard. Repeat for every new video you drop — there&apos;s
                  no cap on how many you can submit.
                </p>
                <p className="mt-2 text-xs text-zinc-500">
                  Made a mistake or want to pull a link?{" "}
                  <code className="rounded bg-white px-1 py-0.5 text-[12px] text-zinc-800 ring-1 ring-zinc-200">
                    /post-remove
                  </code>{" "}
                  removes it (staff also approves edge cases in the
                  staff channel).
                </p>
              </div>
            </li>

            <li className="flex gap-3">
              <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">
                4
              </span>
              <div>
                <p className="font-semibold text-zinc-900">
                  Views sync automatically — and you can force a refresh
                </p>
                <p className="mt-1 text-zinc-600">
                  Once a day the bot pulls fresh view / play counts from
                  YouTube and TikTok for every logged link, and the
                  leaderboard updates on the next page load. Staff can also
                  run{" "}
                  <code className="rounded bg-white px-1 py-0.5 text-[12px] text-zinc-800 ring-1 ring-zinc-200">
                    /update-content
                  </code>{" "}
                  to trigger an immediate sync if something big lands.
                  Brand-new posts show <strong>0 views</strong> until the
                  first sync — that&apos;s normal.
                </p>
              </div>
            </li>

            <li className="flex gap-3">
              <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">
                5
              </span>
              <div>
                <p className="font-semibold text-zinc-900">
                  How the {formatChallengeRobux(ROAD_TO_1M_PRIZE_POOL_ROBUX)}{" "}
                  Robux pool is split
                </p>
                <p className="mt-1 text-zinc-600">
                  When the community hits{" "}
                  <strong className="text-zinc-900">
                    1,000,000 combined
                  </strong>{" "}
                  tracked views / plays, the prize pool unlocks. It&apos;s
                  split{" "}
                  <strong className="text-zinc-900">in proportion</strong> to
                  each creator&apos;s share of the total. So if your videos
                  pulled <strong>10%</strong> of all tracked views, you
                  receive roughly{" "}
                  <strong className="text-emerald-700">
                    {formatChallengeRobux(
                      ROAD_TO_1M_PRIZE_POOL_ROBUX * 0.1,
                    )}{" "}
                    Robux
                  </strong>
                  . Every card on the leaderboard shows a live{" "}
                  <strong className="text-zinc-900">Pool share %</strong> and
                  <strong className="text-zinc-900">Est. Robux</strong> — they
                  shift as more posts and syncs land.
                </p>
              </div>
            </li>

            <li className="flex gap-3">
              <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">
                6
              </span>
              <div>
                <p className="font-semibold text-zinc-900">
                  Top 3 also win Virtuoso sponsored boots
                </p>
                <p className="mt-1 text-zinc-600">
                  In addition to the Robux pool, the{" "}
                  <strong className="text-zinc-900">top 3</strong> finishers
                  by total tracked views each choose a pair of{" "}
                  <strong className="text-zinc-900">
                    Virtuoso-sponsored boots
                  </strong>{" "}
                  — the exact in-game cleats that VF&apos;s best players have
                  received before, and that thousands of players already
                  buy. Want to see what&apos;s on offer?{" "}
                  <Link
                    href="/content/creators/virtuoso"
                    className="font-medium text-blue-800 underline-offset-2 hover:underline"
                  >
                    Browse the Virtuoso gallery
                  </Link>
                  . Ties are settled by VF staff.
                </p>
              </div>
            </li>

            <li className="flex gap-3">
              <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-zinc-700 text-xs font-bold text-white">
                ?
              </span>
              <div>
                <p className="font-semibold text-zinc-900">
                  Quick FAQ for new creators
                </p>
                <ul className="mt-1 space-y-1.5 text-zinc-600">
                  <li>
                    <strong className="text-zinc-900">
                      Do I need a big following?
                    </strong>{" "}
                    No. Every approved creator earns a share — even small
                    accounts add to the community total and get a slice if
                    the goal hits.
                  </li>
                  <li>
                    <strong className="text-zinc-900">
                      Does YouTube Shorts count?
                    </strong>{" "}
                    Yes — Shorts, regular YouTube videos, and TikTok posts
                    all count. We read public view / play counts.
                  </li>
                  <li>
                    <strong className="text-zinc-900">
                      How often does the leaderboard update?
                    </strong>{" "}
                    On every page load. The view numbers themselves refresh
                    on the daily sync (or sooner if staff run{" "}
                    <code className="rounded bg-white px-1 text-[12px] text-zinc-800 ring-1 ring-zinc-200">
                      /update-content
                    </code>
                    ).
                  </li>
                  <li>
                    <strong className="text-zinc-900">
                      Can I delete a post I&apos;m not happy with?
                    </strong>{" "}
                    Use{" "}
                    <code className="rounded bg-white px-1 text-[12px] text-zinc-800 ring-1 ring-zinc-200">
                      /post-remove
                    </code>{" "}
                    on Discord. If a video is removed from TikTok / YouTube
                    its views stop counting on the next sync.
                  </li>
                  <li>
                    <strong className="text-zinc-900">
                      When do I get paid?
                    </strong>{" "}
                    Payouts go out once the 1M goal is hit and VF staff
                    confirm eligibility (no fake views, post is still up,
                    creator profile in good standing).
                  </li>
                </ul>
              </div>
            </li>
          </ol>

          <div className="mt-7 flex flex-wrap items-center gap-2 rounded-lg border border-blue-300/60 bg-blue-50/80 px-4 py-3 text-sm text-blue-900">
            <span className="font-semibold">Ready to start?</span>
            <Link
              href="/content/creators/onboard"
              className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-blue-700"
            >
              Apply as a creator
            </Link>
            <span className="text-blue-800/70">or</span>
            <Link
              href="/content/creators/virtuoso"
              className="text-xs font-semibold text-blue-800 underline-offset-2 hover:underline"
            >
              See the Virtuoso prize boots →
            </Link>
          </div>
        </section>

        <footer className="mt-14 border-t border-white/15 pt-8 text-center text-xs text-white/65 sm:text-sm">
          <p className="flex flex-wrap items-center justify-center gap-x-3 gap-y-2">
            <Link
              href="/"
              className="text-blue-200 underline-offset-2 hover:text-white hover:underline"
            >
              VF home
            </Link>
            <span className="text-white/30">·</span>
            <Link
              href="/content/creators/onboard"
              className="text-blue-200 underline-offset-2 hover:text-white hover:underline"
            >
              Creator onboarding
            </Link>
            <span className="text-white/30">·</span>
            <a
              href="#how-it-works"
              className="text-blue-200 underline-offset-2 hover:text-white hover:underline"
            >
              Rules
            </a>
          </p>
          <p className="mx-auto mt-3 max-w-xl text-[11px] leading-relaxed text-white/50">
            Numbers are indicative until VF staff confirm eligibility and
            payout. Official VF Create rules apply.
          </p>
        </footer>
        </div>
      </div>
    </div>
  );
}
