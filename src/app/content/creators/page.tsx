import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
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
import {
  tiktokProfileHref,
  youtubeProfileHref,
} from "@/lib/creator-onboard/validators";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "VF Create · Road to 1M",
  description:
    "VF Create challenge to 1M views — 50,000 Robux pool, VF Brand sponsor prizes for top 3. Leaderboard updates as creators post.",
  openGraph: {
    title: "VF Create · Road to 1M",
    description:
      "Track the sprint to 1M views and see creator standings · VF Brand sponsor · Robux pool.",
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

      <div className="relative mx-auto max-w-6xl px-3 pt-4 pb-12 sm:px-6 sm:pb-16 lg:px-8">
        <div>
          <SiteNav />

          <header className="mt-6 space-y-3 pb-6 sm:mt-10 sm:space-y-4 sm:pb-10">
            {challenge.milestoneReached ? (
              <p className="text-sm font-medium text-emerald-200">
                Community total reached one million tracked views / plays.
              </p>
            ) : null}
            <p className="text-[10px] font-semibold uppercase tracking-[0.32em] text-white/55">
              VF Create
            </p>
            <h1 className="text-[28px] font-bold leading-[1.1] tracking-tight sm:text-4xl md:text-5xl">
              Road to 1M
            </h1>
            <p className="max-w-2xl text-[15px] leading-relaxed text-white/85 sm:text-[17px]">
              Approved VF Create members add posts with{" "}
              <code className="rounded bg-white/15 px-1 py-0.5 text-[13px] text-white sm:text-sm">
                /posted
              </code>{" "}
              on Discord. YouTube views and TikTok plays sync on the daily job
              (and when staff run{" "}
              <code className="rounded bg-white/15 px-1 py-0.5 text-[13px] text-white sm:text-sm">
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
                VF Brand sponsored boots
              </strong>{" "}
              of their choice (staff confirm ties).
            </p>
          </header>
        </div>

        <div>
        {/* Community progress */}
        <section
          className="relative mt-6 overflow-hidden rounded-3xl border border-white/15 bg-white/[0.04] p-5 shadow-[0_30px_80px_-30px_rgba(80,140,255,0.55)] backdrop-blur-xl sm:mt-8 sm:p-9"
          aria-labelledby="progress-heading"
        >
          <div
            aria-hidden
            className="pointer-events-none absolute -top-24 -right-16 size-72 rounded-full opacity-50 blur-3xl"
            style={{
              backgroundImage:
                "radial-gradient(circle, rgba(255,180,80,0.55) 0%, rgba(255,90,180,0.25) 45%, rgba(80,140,255,0) 75%)",
            }}
          />
          <div className="relative flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between sm:gap-6">
            <div className="min-w-0 space-y-2">
              <p className="inline-flex items-center gap-2 rounded-full border border-fuchsia-300/40 bg-fuchsia-400/15 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-fuchsia-100">
                <span aria-hidden>🚀</span> Live progress
              </p>
              <h2
                id="progress-heading"
                className="text-xl font-bold text-white sm:text-2xl md:text-3xl"
              >
                Community progress
              </h2>
              <p className="break-words text-sm leading-relaxed text-white/75 sm:text-base">
                <strong className="text-white">
                  {formatTargetNumber(challenge.totalTrackedViews)}
                </strong>{" "}
                <span className="text-white/50">/</span>{" "}
                <strong className="text-white">
                  {formatTargetNumber(ROAD_TO_1M_TARGET_VIEWS)}
                </strong>{" "}
                tracked views &amp; plays
                {showOverflow ? (
                  <span className="ml-1 text-white/55">
                    ({formatViewCount(challenge.totalTrackedViews)} total)
                  </span>
                ) : null}
              </p>
            </div>
            <div className="text-left sm:shrink-0 sm:text-right">
              <p className="bg-gradient-to-br from-amber-200 via-pink-300 to-violet-300 bg-clip-text text-5xl font-black leading-none tracking-tight text-transparent sm:text-6xl md:text-7xl">
                {challenge.progressPercent.toFixed(1)}%
              </p>
              <p className="mt-2 text-xs font-semibold uppercase tracking-[0.18em] text-white/55 sm:text-sm">
                of the 1M goal
              </p>
            </div>
          </div>

          <div className="relative mt-7 sm:mt-9">
            <div
              className="relative h-7 overflow-hidden rounded-full border border-white/10 bg-white/5 ring-1 ring-inset ring-white/10 shadow-[inset_0_2px_8px_rgba(0,0,0,0.45)] sm:h-9"
              role="progressbar"
              aria-valuenow={Math.round(
                Math.min(100, challenge.progressPercent),
              )}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Progress toward one million views"
            >
              <div
                className="relative h-full rounded-full transition-[width] duration-700 ease-out"
                style={{
                  width: `${Math.min(100, barWidthPercent)}%`,
                  backgroundImage:
                    "linear-gradient(90deg, #38bdf8 0%, #6366f1 35%, #ec4899 70%, #f97316 100%)",
                  boxShadow:
                    "0 0 20px rgba(236,72,153,0.55), 0 0 40px rgba(99,102,241,0.45)",
                }}
              >
                <div
                  aria-hidden
                  className="absolute inset-0 rounded-full opacity-70 mix-blend-overlay"
                  style={{
                    backgroundImage:
                      "linear-gradient(90deg, rgba(255,255,255,0.55) 0%, rgba(255,255,255,0) 60%)",
                  }}
                />
              </div>
              <span
                aria-hidden
                className="pointer-events-none absolute top-1/2 -translate-y-1/2 text-2xl drop-shadow-[0_0_12px_rgba(255,200,120,0.9)] transition-[left] duration-700 ease-out sm:text-3xl"
                style={{
                  left: `calc(${Math.min(100, barWidthPercent)}% - 0.85rem)`,
                }}
              >
                🔥
              </span>
            </div>
          </div>
          <p className="relative mt-4 text-xs leading-relaxed text-white/55 sm:text-sm">
            New links show <span className="text-white/80">0 views</span> until the next metrics sync. Hit the
            goal and the entire pool unlocks 💥
          </p>
        </section>

        {/* Leaderboard — directly under progress */}
        <section id="leaderboard" className="mt-12 scroll-mt-24 sm:mt-16">
          <div className="flex flex-col gap-6 pb-6 sm:flex-row sm:items-end sm:justify-between">
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.32em] text-white/45">
                Standings
              </p>
              <h2 className="mt-2 text-3xl font-bold tracking-tight text-white sm:text-4xl">
                Leaderboard
              </h2>
              <p className="mt-2 max-w-xl text-sm leading-relaxed text-white/55 sm:text-[15px]">
                Ranked by total synced views &amp; plays. Refreshes every page load.
              </p>
            </div>
            <div className="flex flex-col gap-2 text-left sm:items-end sm:text-right">
              <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-white/40">
                Prize pool
              </p>
              <p className="flex items-center gap-2 sm:justify-end">
                <Image
                  src="/Robux_2019_Logo_white.svg.png"
                  alt=""
                  width={28}
                  height={28}
                  className="size-6 shrink-0 sm:size-7"
                />
                <span className="text-2xl font-bold tabular-nums text-white sm:text-3xl">
                  {formatChallengeRobux(challenge.prizePoolRobux).replace(
                    " Robux",
                    "",
                  )}
                </span>
                <span className="text-sm text-white/55 sm:text-base">Robux</span>
              </p>
              <p className="text-xs text-white/45">
                Top 3 also get{" "}
                <Link
                  href="/content/creators/vf-brand"
                  className="text-white/80 underline-offset-2 hover:text-white hover:underline"
                >
                  VF Brand sponsored boots
                </Link>
              </p>
            </div>
          </div>
          <div className="h-px bg-gradient-to-r from-transparent via-white/15 to-transparent" />

          <div className="mt-6 space-y-2.5 sm:mt-8 sm:space-y-3">
            {challenge.leaderboard.length === 0 ? (
              <p className="rounded-2xl border border-white/10 bg-white/[0.02] px-6 py-8 text-center text-sm leading-relaxed text-white/65 sm:px-8 sm:py-10 sm:text-[15px]">
                No posts on the board yet. Approved creators: add a link with{" "}
                <code className="rounded bg-white/10 px-1.5 py-0.5 text-white">
                  /posted
                </code>{" "}
                in Discord — first link in takes #1.
              </p>
            ) : null}
            {(() => {
              const filled = challenge.leaderboard;
              const placeholderCount = Math.max(0, 10 - filled.length);
              const placeholderRanks = Array.from(
                { length: placeholderCount },
                (_, i) => filled.length + i + 1,
              );
              const rankAccent = (rank: number) => {
                if (rank === 1)
                  return {
                    bar: "bg-gradient-to-b from-amber-200 via-amber-400 to-amber-600",
                    rankText: "text-amber-300",
                    label: "1st",
                    chipBorder: "border-amber-300/35",
                    chipText: "text-amber-200/90",
                  };
                if (rank === 2)
                  return {
                    bar: "bg-gradient-to-b from-zinc-200 via-zinc-300 to-zinc-500",
                    rankText: "text-zinc-200",
                    label: "2nd",
                    chipBorder: "border-zinc-300/30",
                    chipText: "text-zinc-200/85",
                  };
                if (rank === 3)
                  return {
                    bar: "bg-gradient-to-b from-orange-300 via-orange-400 to-orange-700",
                    rankText: "text-orange-300",
                    label: "3rd",
                    chipBorder: "border-orange-300/30",
                    chipText: "text-orange-200/90",
                  };
                return {
                  bar: "bg-white/[0.08]",
                  rankText: "text-white/45",
                  label: "",
                  chipBorder: "border-white/10",
                  chipText: "text-white/55",
                };
              };
              const formatRankNum = (n: number) =>
                n < 10 ? `0${n}` : String(n);
              return (
                <>
                  {filled.map((row) => {
                    const country = countryLabel(row.country);
                    const cRow = creatorById.get(row.id);
                    const tiktokUrl = tiktokProfileHref(
                      cRow?.tiktok_handle ?? null,
                    );
                    const youtubeUrl = youtubeProfileHref(
                      cRow?.youtube_handle ?? null,
                    );
                    const brandPick = row.rank <= 3 && row.totalViews > 0;
                    const accent = rankAccent(row.rank);

                    return (
                      <article
                        key={row.id}
                        className="group relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.025] transition hover:border-white/20 hover:bg-white/[0.04]"
                      >
                        <div className="flex">
                          <div
                            aria-hidden
                            className={`w-1 shrink-0 ${accent.bar}`}
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-4 px-4 py-4 sm:gap-5 sm:px-6 sm:py-5">
                              <div className="flex w-10 shrink-0 flex-col items-center sm:w-14">
                                <span
                                  className={`text-2xl font-bold tabular-nums tracking-tight sm:text-3xl ${accent.rankText}`}
                                >
                                  {formatRankNum(row.rank)}
                                </span>
                              </div>
                              {row.robloxAvatarUrl ? (
                                /* eslint-disable-next-line @next/next/no-img-element */
                                <img
                                  src={row.robloxAvatarUrl}
                                  alt=""
                                  width={48}
                                  height={48}
                                  className="size-11 shrink-0 rounded-full object-cover ring-1 ring-white/15 sm:size-12"
                                />
                              ) : (
                                <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-white/10 text-sm font-semibold text-white/80 ring-1 ring-white/15 sm:size-12 sm:text-base">
                                  {row.displayName.slice(0, 1).toUpperCase()}
                                </div>
                              )}
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-base font-semibold text-white sm:text-lg">
                                  {row.displayName}
                                </p>
                                <p className="mt-0.5 truncate text-xs text-white/55 sm:text-sm">
                                  {row.robloxUsername}
                                  {country ? (
                                    <span className="text-white/35"> · {country}</span>
                                  ) : null}
                                  {tiktokUrl ? (
                                    <>
                                      <span className="text-white/25"> · </span>
                                      <a
                                        href={tiktokUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-white/70 underline-offset-2 hover:text-white hover:underline"
                                      >
                                        TikTok
                                      </a>
                                    </>
                                  ) : null}
                                  {youtubeUrl ? (
                                    <>
                                      <span className="text-white/25"> · </span>
                                      <a
                                        href={youtubeUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-white/70 underline-offset-2 hover:text-white hover:underline"
                                      >
                                        YouTube
                                      </a>
                                    </>
                                  ) : null}
                                </p>
                                {brandPick ? (
                                  <p
                                    className={`mt-1.5 inline-flex items-center gap-1.5 rounded-full border ${accent.chipBorder} bg-white/[0.03] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] ${accent.chipText}`}
                                  >
                                    <span aria-hidden>—</span> {accent.label} · VF Brand boot
                                  </p>
                                ) : null}
                              </div>
                              <div className="hidden shrink-0 items-baseline gap-2 text-right sm:flex">
                                <Image
                                  src="/Robux_2019_Logo_white.svg.png"
                                  alt=""
                                  width={20}
                                  height={20}
                                  className="size-4 self-center opacity-80"
                                />
                                <p className="text-xl font-bold tabular-nums text-white sm:text-2xl">
                                  {formatChallengeRobux(
                                    row.estimatedPayoutRobux,
                                  ).replace(" Robux", "")}
                                </p>
                              </div>
                            </div>

                            <div className="grid grid-cols-3 divide-x divide-white/10 border-t border-white/10 sm:grid-cols-4">
                              <div className="px-4 py-3 sm:px-6 sm:py-3.5">
                                <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-white/40">
                                  Views
                                </p>
                                <p className="mt-1 text-base font-semibold tabular-nums text-white sm:text-lg">
                                  {formatViewCount(row.totalViews)}
                                </p>
                              </div>
                              <div className="px-4 py-3 sm:px-6 sm:py-3.5">
                                <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-white/40">
                                  Posts
                                </p>
                                <p className="mt-1 text-base font-semibold tabular-nums text-white sm:text-lg">
                                  {row.postCount}
                                </p>
                              </div>
                              <div className="px-4 py-3 sm:px-6 sm:py-3.5">
                                <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-white/40">
                                  Share
                                </p>
                                <p className="mt-1 text-base font-semibold tabular-nums text-white sm:text-lg">
                                  {formatPoolSharePercent(row.poolSharePercent)}
                                </p>
                              </div>
                              <div className="px-4 py-3 sm:hidden">
                                <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-white/40">
                                  Reward
                                </p>
                                <p className="mt-1 flex items-center gap-1.5 text-base font-semibold tabular-nums text-white">
                                  <Image
                                    src="/Robux_2019_Logo_white.svg.png"
                                    alt=""
                                    width={16}
                                    height={16}
                                    className="size-3.5 opacity-80"
                                  />
                                  {formatChallengeRobux(
                                    row.estimatedPayoutRobux,
                                  ).replace(" Robux", "")}
                                </p>
                              </div>
                              <div className="hidden px-4 py-3 sm:block sm:px-6 sm:py-3.5">
                                <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-white/40">
                                  Reward
                                </p>
                                <p className="mt-1 flex items-center gap-1.5 text-base font-semibold tabular-nums text-white sm:text-lg">
                                  <Image
                                    src="/Robux_2019_Logo_white.svg.png"
                                    alt=""
                                    width={18}
                                    height={18}
                                    className="size-4 opacity-80"
                                  />
                                  {formatChallengeRobux(
                                    row.estimatedPayoutRobux,
                                  ).replace(" Robux", "")}
                                </p>
                              </div>
                            </div>

                            <details className="group/d border-t border-white/10">
                              <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-xs font-medium text-white/55 transition hover:text-white sm:px-6 sm:text-sm">
                                <span>
                                  View {row.postCount} post
                                  {row.postCount === 1 ? "" : "s"}
                                </span>
                                <span
                                  className="text-white/35 transition group-open/d:rotate-180"
                                  aria-hidden
                                >
                                  ▾
                                </span>
                              </summary>
                              <ul className="border-t border-white/10 px-4 pb-3 pt-2 sm:px-6 sm:pb-4">
                                {row.posts.map((p) => {
                                  const dateLabel = formatPostedDate(
                                    p.posted_at,
                                  );
                                  const viewsLabel =
                                    typeof p.view_count === "number"
                                      ? formatViewCount(p.view_count)
                                      : null;
                                  return (
                                    <li
                                      key={`${row.id}-${p.posted_at}-${p.url}`}
                                      className="flex flex-col gap-0.5 border-b border-white/[0.06] py-2.5 text-xs last:border-b-0 last:pb-1 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:text-sm"
                                    >
                                      <a
                                        href={p.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="font-medium text-white/85 underline-offset-2 hover:text-white hover:underline"
                                      >
                                        {postHostLabel(p.url)}
                                        {dateLabel ? (
                                          <span className="ml-2 font-normal text-white/40">
                                            {dateLabel}
                                          </span>
                                        ) : null}
                                      </a>
                                      <span className="tabular-nums text-white/50">
                                        {viewsLabel ? (
                                          <>
                                            <span className="text-white/75">
                                              {viewsLabel}
                                            </span>{" "}
                                            {p.views_source === "tiktok"
                                              ? "plays"
                                              : "views"}
                                            {p.views_fetched_at ? (
                                              <span className="text-white/35">
                                                {" "}
                                                · sync{" "}
                                                {formatPostedDate(
                                                  p.views_fetched_at,
                                                )}
                                              </span>
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
                          </div>
                        </div>
                      </article>
                    );
                  })}
                  {placeholderRanks.map((rank) => (
                    <article
                      key={`placeholder-${rank}`}
                      className="flex items-center gap-4 rounded-2xl border border-dashed border-white/10 bg-white/[0.015] px-4 py-3 transition hover:border-white/25 hover:bg-white/[0.03] sm:gap-5 sm:px-6 sm:py-4"
                    >
                      <span className="w-10 shrink-0 text-center text-xl font-bold tabular-nums text-white/30 sm:w-14 sm:text-2xl">
                        {formatRankNum(rank)}
                      </span>
                      <div className="flex size-11 shrink-0 items-center justify-center rounded-full border border-dashed border-white/15 text-base text-white/30 sm:size-12 sm:text-lg">
                        —
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-white/70 sm:text-base">
                          Open slot
                        </p>
                        <p className="mt-0.5 text-xs text-white/45 sm:text-[13px]">
                          {rank <= 3
                            ? "Top 3 also claim a VF Brand sponsored boot."
                            : "Post a VF video and run /posted to lock in this spot."}
                        </p>
                      </div>
                      <Link
                        href="/content/creators/onboard"
                        className="shrink-0 rounded-lg border border-white/15 px-3 py-1.5 text-xs font-medium text-white/80 transition hover:border-white/30 hover:bg-white/5 hover:text-white sm:px-4 sm:py-2 sm:text-sm"
                      >
                        Apply
                      </Link>
                    </article>
                  ))}
                </>
              );
            })()}
          </div>
        </section>

        {/* Quick stats */}
        <section className="mt-10 grid divide-y divide-white/10 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02] sm:mt-12 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
          <div className="px-5 py-5 sm:px-6 sm:py-6">
            <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-white/45">
              Posts live
            </p>
            <p className="mt-2 text-3xl font-bold tabular-nums text-white sm:text-4xl">
              {challenge.totalPostCount}
            </p>
            <p className="mt-1.5 text-xs text-white/45 sm:text-[13px]">
              from {challenge.participantCount} creator
              {challenge.participantCount === 1 ? "" : "s"}
            </p>
          </div>
          <div className="px-5 py-5 sm:px-6 sm:py-6">
            <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-white/45">
              On leaderboard
            </p>
            <p className="mt-2 text-3xl font-bold tabular-nums text-white sm:text-4xl">
              {challenge.leaderboard.length}
            </p>
            <p className="mt-1.5 text-xs text-white/45 sm:text-[13px]">
              with at least one post
            </p>
          </div>
          <div className="px-5 py-5 sm:px-6 sm:py-6">
            <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-white/45">
              Top 3 reward
            </p>
            <p className="mt-2 text-xl font-semibold text-white sm:text-2xl">
              VF Brand sponsored boots
            </p>
            <p className="mt-1.5 text-xs text-white/45 sm:text-[13px]">
              In addition to the Robux pool share
            </p>
          </div>
        </section>

        <section
          id="how-it-works"
          className="relative mt-12 scroll-mt-24 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02] p-5 sm:mt-14 sm:p-9"
        >
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.32em] text-white/45">
              New here? Start here
            </p>
            <h2 className="mt-2 text-2xl font-bold tracking-tight text-white sm:text-3xl">
              VF Create · the full beginner guide
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-white/70 sm:text-[15px]">
              VF Create is the Virtual Football content program. You make
              short videos about VF — clips, montages, reactions, guides — post
              them on TikTok and/or YouTube, then log the link with our Discord
              bot. The community is racing to{" "}
              <strong className="text-white">1,000,000 combined views</strong>{" "}
              and unlocking a{" "}
              <strong className="text-white">
                {formatChallengeRobux(ROAD_TO_1M_PRIZE_POOL_ROBUX)}
              </strong>{" "}
              pool. No prior experience required — this guide walks you through
              every step.
            </p>
          </div>

          <ol className="mt-7 space-y-5 text-sm leading-relaxed text-white/70 sm:mt-8 sm:space-y-6 sm:text-[15px]">
            <li className="flex gap-4">
              <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/[0.04] text-xs font-semibold tabular-nums text-white/80">
                1
              </span>
              <div>
                <p className="text-base font-semibold text-white sm:text-lg">
                  Get approved as a VF Creator
                </p>
                <p className="mt-1.5 text-white/70">
                  Apply through{" "}
                  <Link
                    href="/content/creators/onboard"
                    className="font-semibold text-sky-200 underline-offset-2 hover:text-white hover:underline"
                  >
                    Creator onboarding
                  </Link>
                  . You&apos;ll link your Discord, your Roblox account, and
                  drop your TikTok / YouTube handle so we know who&apos;s
                  posting. Staff review and approve — once you&apos;re in,
                  you get the{" "}
                  <strong className="text-white">Creator</strong> role on
                  Discord and unlock the{" "}
                  <code className="rounded bg-white/10 px-1.5 py-0.5 text-[12px] text-white ring-1 ring-white/15">
                    /posted
                  </code>{" "}
                  command.
                </p>
              </div>
            </li>

            <li className="flex gap-4">
              <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/[0.04] text-xs font-semibold tabular-nums text-white/80">
                2
              </span>
              <div>
                <p className="text-base font-semibold text-white sm:text-lg">
                  Make a VF video and post it publicly
                </p>
                <p className="mt-1.5 text-white/70">
                  Anything VF-themed counts — gameplay clips, match
                  highlights, edits, tutorials, reactions, comedy. Upload it
                  to your{" "}
                  <strong className="text-white">TikTok</strong> or{" "}
                  <strong className="text-white">YouTube</strong> channel
                  (the same one you registered during onboarding). Make sure
                  the post is public so we can read view / play counts.
                </p>
              </div>
            </li>

            <li className="flex gap-4">
              <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/[0.04] text-xs font-semibold tabular-nums text-white/80">
                3
              </span>
              <div>
                <p className="text-base font-semibold text-white sm:text-lg">
                  Log it with{" "}
                  <code className="rounded bg-white/10 px-1.5 py-0.5 text-[13px] text-white ring-1 ring-white/15">
                    /posted
                  </code>{" "}
                  on Discord
                </p>
                <p className="mt-1.5 text-white/70">
                  In any channel the bot can see, type{" "}
                  <code className="rounded bg-white/10 px-1.5 py-0.5 text-[12px] text-white ring-1 ring-white/15">
                    /posted url:&lt;your link&gt;
                  </code>{" "}
                  and paste the full URL of the video. The bot saves it
                  against your creator profile and adds it to the
                  leaderboard. Repeat for every new video you drop — there&apos;s
                  no cap on how many you can submit.
                </p>
                <p className="mt-2 text-xs text-white/55">
                  Made a mistake or want to pull a link?{" "}
                  <code className="rounded bg-white/10 px-1.5 py-0.5 text-[12px] text-white ring-1 ring-white/15">
                    /post-remove
                  </code>{" "}
                  removes it (staff also approves edge cases in the
                  staff channel).
                </p>
              </div>
            </li>

            <li className="flex gap-4">
              <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/[0.04] text-xs font-semibold tabular-nums text-white/80">
                4
              </span>
              <div>
                <p className="text-base font-semibold text-white sm:text-lg">
                  Views sync automatically — and you can force a refresh
                </p>
                <p className="mt-1.5 text-white/70">
                  Once a day the bot pulls fresh view / play counts from
                  YouTube and TikTok for every logged link, and the
                  leaderboard updates on the next page load. Staff can also
                  run{" "}
                  <code className="rounded bg-white/10 px-1.5 py-0.5 text-[12px] text-white ring-1 ring-white/15">
                    /update-content
                  </code>{" "}
                  to trigger an immediate sync if something big lands.
                  Brand-new posts show <strong className="text-white">0 views</strong>
                  {" "}until the first sync — that&apos;s normal.
                </p>
              </div>
            </li>

            <li className="flex gap-4">
              <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/[0.04] text-xs font-semibold tabular-nums text-white/80">
                5
              </span>
              <div>
                <p className="text-base font-semibold text-white sm:text-lg">
                  How the {formatChallengeRobux(ROAD_TO_1M_PRIZE_POOL_ROBUX)}
                  {" "}pool is split
                </p>
                <p className="mt-1.5 text-white/70">
                  When the community hits{" "}
                  <strong className="text-white">1,000,000 combined</strong>{" "}
                  tracked views / plays, the prize pool unlocks. It&apos;s
                  split{" "}
                  <strong className="text-white">in proportion</strong>
                  {" "}to each creator&apos;s share of the total. So if your
                  videos pulled <strong className="text-white">10%</strong> of all tracked views,
                  you receive roughly{" "}
                  <strong className="text-emerald-200">
                    {formatChallengeRobux(
                      ROAD_TO_1M_PRIZE_POOL_ROBUX * 0.1,
                    )}
                  </strong>
                  . Every card on the leaderboard shows a live{" "}
                  <strong className="text-white">Pool share %</strong>
                  {" "}and{" "}
                  <strong className="text-white">Est. Robux</strong>
                  {" "}— they shift as more posts and syncs land.
                </p>
              </div>
            </li>

            <li className="flex gap-4">
              <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/[0.04] text-xs font-semibold tabular-nums text-white/80">
                6
              </span>
              <div>
                <p className="text-base font-semibold text-white sm:text-lg">
                  Top 3 also win VF Brand sponsored boots
                </p>
                <p className="mt-1.5 text-white/70">
                  In addition to the Robux pool, the{" "}
                  <strong className="text-white">top 3</strong> finishers
                  by total tracked views each choose a pair of{" "}
                  <strong className="text-white">
                    VF Brand sponsored boots
                  </strong>{" "}
                  — the exact in-game cleats that VF&apos;s best players have
                  received before, and that thousands of players already
                  buy. Want to see what&apos;s on offer?{" "}
                  <Link
                    href="/content/creators/vf-brand"
                    className="font-semibold text-amber-200 underline-offset-2 hover:text-white hover:underline"
                  >
                    Browse the VF Brand Gallery
                  </Link>
                  . Ties are settled by VF staff.
                </p>
              </div>
            </li>

            <li className="flex gap-4">
              <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/[0.04] text-xs font-semibold text-white/80">
                ?
              </span>
              <div>
                <p className="text-base font-semibold text-white sm:text-lg">
                  Quick FAQ for new creators
                </p>
                <ul className="mt-2 space-y-1.5 text-white/70">
                  <li>
                    <strong className="text-white">
                      Do I need a big following?
                    </strong>{" "}
                    No. Every approved creator earns a share — even small
                    accounts add to the community total and get a slice if
                    the goal hits.
                  </li>
                  <li>
                    <strong className="text-white">
                      Does YouTube Shorts count?
                    </strong>{" "}
                    Yes — Shorts, regular YouTube videos, and TikTok posts
                    all count. We read public view / play counts.
                  </li>
                  <li>
                    <strong className="text-white">
                      How often does the leaderboard update?
                    </strong>{" "}
                    On every page load. The view numbers themselves refresh
                    on the daily sync (or sooner if staff run{" "}
                    <code className="rounded bg-white/10 px-1.5 py-0.5 text-[12px] text-white ring-1 ring-white/15">
                      /update-content
                    </code>
                    ).
                  </li>
                  <li>
                    <strong className="text-white">
                      Can I delete a post I&apos;m not happy with?
                    </strong>{" "}
                    Use{" "}
                    <code className="rounded bg-white/10 px-1.5 py-0.5 text-[12px] text-white ring-1 ring-white/15">
                      /post-remove
                    </code>{" "}
                    on Discord. If a video is removed from TikTok / YouTube
                    its views stop counting on the next sync.
                  </li>
                  <li>
                    <strong className="text-white">
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

          <div className="mt-8 flex flex-wrap items-center gap-x-4 gap-y-3 border-t border-white/10 pt-6 text-sm text-white/70 sm:mt-10 sm:pt-7">
            <span className="font-medium text-white">Ready to start?</span>
            <Link
              href="/content/creators/onboard"
              className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-zinc-950 transition hover:bg-white/90"
            >
              Apply as a creator
            </Link>
            <Link
              href="/content/creators/vf-brand"
              className="text-sm text-white/70 underline-offset-2 hover:text-white hover:underline"
            >
              See the VF Brand prize boots
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
