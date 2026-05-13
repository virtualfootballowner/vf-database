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
        <section id="leaderboard" className="mt-10 scroll-mt-24 sm:mt-14">
          <div className="flex flex-col gap-5 border-b border-white/10 pb-7 sm:flex-row sm:items-end sm:justify-between">
            <div className="min-w-0 space-y-2">
              <p className="inline-flex items-center gap-2 rounded-full border border-amber-300/40 bg-amber-400/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-100">
                <span aria-hidden>🏆</span> Standings
              </p>
              <h2 className="text-2xl font-black tracking-tight text-white sm:text-3xl md:text-4xl">
                Leaderboard
              </h2>
              <p className="max-w-xl text-sm leading-relaxed text-white/65 sm:text-base sm:leading-relaxed">
                Sorted by total synced views / plays · updates on each page
                load
              </p>
            </div>
            <div className="flex flex-col gap-2 sm:items-end">
              <div className="inline-flex flex-wrap items-center gap-2.5 rounded-2xl border border-emerald-300/30 bg-gradient-to-br from-emerald-400/15 via-cyan-400/10 to-violet-400/15 px-4 py-3 text-sm font-semibold text-white shadow-[0_15px_45px_-20px_rgba(16,185,129,0.55)] backdrop-blur sm:px-5 sm:py-3.5">
                <Image
                  src="/Robux_2019_Logo_white.svg.png"
                  alt=""
                  width={28}
                  height={28}
                  className="size-6 shrink-0 drop-shadow-[0_0_8px_rgba(16,185,129,0.55)] sm:size-7"
                />
                <span className="text-white/85">Pool:</span>
                <span className="bg-gradient-to-r from-emerald-200 via-emerald-100 to-amber-100 bg-clip-text text-lg font-black tabular-nums text-transparent sm:text-xl">
                  {formatChallengeRobux(challenge.prizePoolRobux)}
                </span>
              </div>
              <span className="inline-flex items-center gap-1.5 self-start rounded-full border border-violet-300/40 bg-violet-400/15 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-violet-100 sm:self-end sm:text-xs">
                <span aria-hidden>👟</span> VF Brand sponsor · top 3
              </span>
              <Link
                href="/content/creators/vf-brand"
                className="text-[11px] font-medium text-blue-200 underline-offset-2 hover:text-white hover:underline sm:text-right sm:text-xs"
              >
                What is this?
              </Link>
            </div>
          </div>

          <div className="mt-8 space-y-5 sm:mt-10 sm:space-y-6">
            {challenge.leaderboard.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-white/25 bg-white/[0.04] px-6 py-8 text-center text-sm leading-relaxed text-white/75 backdrop-blur sm:px-8 sm:py-10 sm:text-base">
                No posts on the board yet. Approved creators: add a link with{" "}
                <code className="rounded bg-white/10 px-1.5 py-0.5 text-white">
                  /posted
                </code>{" "}
                in Discord. The slots below are still open — first link in
                takes #1.
              </p>
            ) : null}
            {(() => {
              const filled = challenge.leaderboard;
              const placeholderCount = Math.max(0, 10 - filled.length);
              const placeholderRanks = Array.from(
                { length: placeholderCount },
                (_, i) => filled.length + i + 1,
              );
              const rankMedal = (rank: number): string | null => {
                if (rank === 1) return "🥇";
                if (rank === 2) return "🥈";
                if (rank === 3) return "🥉";
                return null;
              };
              const rankAccent = (rank: number) => {
                if (rank === 1) {
                  return {
                    border: "border-amber-300/40",
                    glow: "shadow-[0_30px_80px_-30px_rgba(251,191,36,0.55)]",
                    gradient:
                      "bg-gradient-to-br from-amber-400/[0.18] via-amber-500/[0.06] to-transparent",
                    badge:
                      "bg-gradient-to-br from-amber-300 to-orange-500 text-amber-950 shadow-[0_0_25px_rgba(251,191,36,0.6)]",
                    ring: "ring-amber-300/50",
                  };
                }
                if (rank === 2) {
                  return {
                    border: "border-zinc-200/30",
                    glow: "shadow-[0_30px_80px_-30px_rgba(229,231,235,0.35)]",
                    gradient:
                      "bg-gradient-to-br from-zinc-100/[0.12] via-zinc-200/[0.04] to-transparent",
                    badge:
                      "bg-gradient-to-br from-zinc-200 to-zinc-400 text-zinc-900 shadow-[0_0_22px_rgba(229,231,235,0.4)]",
                    ring: "ring-zinc-200/40",
                  };
                }
                if (rank === 3) {
                  return {
                    border: "border-orange-300/35",
                    glow: "shadow-[0_30px_80px_-30px_rgba(251,146,60,0.45)]",
                    gradient:
                      "bg-gradient-to-br from-orange-400/[0.14] via-orange-500/[0.05] to-transparent",
                    badge:
                      "bg-gradient-to-br from-orange-300 to-amber-700 text-orange-950 shadow-[0_0_22px_rgba(251,146,60,0.5)]",
                    ring: "ring-orange-300/40",
                  };
                }
                return {
                  border: "border-white/10",
                  glow: "shadow-[0_20px_50px_-30px_rgba(0,0,0,0.55)]",
                  gradient:
                    "bg-gradient-to-br from-white/[0.04] via-white/[0.02] to-transparent",
                  badge: "bg-white/10 text-white/80",
                  ring: "ring-white/15",
                };
              };
              return (
                <>
                  {filled.map((row) => {
                const country = countryLabel(row.country);
                const cRow = creatorById.get(row.id);
                const tiktokUrl = tiktokProfileHref(cRow?.tiktok_handle ?? null);
                const youtubeUrl = youtubeProfileHref(cRow?.youtube_handle ?? null);
                const brandPick = row.rank <= 3 && row.totalViews > 0;
                const accent = rankAccent(row.rank);
                const medal = rankMedal(row.rank);

                return (
                  <article
                    key={row.id}
                    className={`group relative overflow-hidden rounded-3xl border ${accent.border} ${accent.glow} bg-white/[0.03] backdrop-blur-xl`}
                  >
                    <div
                      aria-hidden
                      className={`pointer-events-none absolute inset-0 ${accent.gradient}`}
                    />
                    <div className="relative flex flex-col gap-6 p-5 sm:gap-7 sm:p-7 md:p-8">
                      <div className="flex items-start gap-4 sm:gap-6">
                        <div className="flex shrink-0 items-center gap-3 sm:gap-5">
                          <span
                            className={`flex size-14 items-center justify-center rounded-2xl text-2xl font-black tabular-nums sm:size-16 sm:rounded-3xl sm:text-3xl ${accent.badge}`}
                          >
                            {medal ?? `#${row.rank}`}
                          </span>
                          {row.robloxAvatarUrl ? (
                            /* eslint-disable-next-line @next/next/no-img-element */
                            <img
                              src={row.robloxAvatarUrl}
                              alt=""
                              width={64}
                              height={64}
                              className={`size-14 rounded-2xl object-cover ring-2 ${accent.ring} sm:size-16`}
                            />
                          ) : (
                            <div
                              className={`flex size-14 items-center justify-center rounded-2xl bg-white/5 text-xl font-bold text-white ring-2 ${accent.ring} sm:size-16 sm:text-2xl`}
                            >
                              {row.displayName.slice(0, 1).toUpperCase()}
                            </div>
                          )}
                        </div>

                        <div className="min-w-0 flex-1 space-y-1.5">
                          <p className="truncate text-lg font-bold text-white sm:text-2xl">
                            {row.displayName}
                          </p>
                          <p className="truncate text-sm leading-relaxed text-white/60 sm:text-base">
                            <span className="font-medium text-white/80">
                              {row.robloxUsername}
                            </span>
                            {country ? (
                              <>
                                {" "}
                                <span className="text-white/40">·</span> {country}
                              </>
                            ) : null}
                          </p>
                          <div className="flex flex-wrap gap-2 pt-2 text-xs sm:text-sm">
                            {tiktokUrl ? (
                              <a
                                href={tiktokUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 rounded-full border border-pink-300/40 bg-pink-400/15 px-2.5 py-1 font-semibold text-pink-100 transition hover:border-pink-300/70 hover:bg-pink-400/25"
                              >
                                <span aria-hidden>🎵</span> TikTok
                              </a>
                            ) : null}
                            {youtubeUrl ? (
                              <a
                                href={youtubeUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 rounded-full border border-red-400/40 bg-red-500/15 px-2.5 py-1 font-semibold text-red-100 transition hover:border-red-400/70 hover:bg-red-500/25"
                              >
                                <span aria-hidden>▶️</span> YouTube
                              </a>
                            ) : null}
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
                        <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-sky-500/10 via-white/[0.03] to-transparent p-4 sm:p-5">
                          <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-sky-200 sm:text-xs">
                            <span aria-hidden>👀</span> Views
                          </div>
                          <p className="mt-2 truncate text-3xl font-black tabular-nums text-white sm:text-4xl">
                            {formatViewCount(row.totalViews)}
                          </p>
                        </div>
                        <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-violet-500/10 via-white/[0.03] to-transparent p-4 sm:p-5">
                          <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-violet-200 sm:text-xs">
                            <span aria-hidden>🎬</span> Posts
                          </div>
                          <p className="mt-2 text-3xl font-black tabular-nums text-white sm:text-4xl">
                            {row.postCount}
                          </p>
                        </div>
                        <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-cyan-500/10 via-white/[0.03] to-transparent p-4 sm:p-5">
                          <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-cyan-200 sm:text-xs">
                            <span aria-hidden>📊</span> Pool share
                          </div>
                          <p className="mt-2 truncate text-3xl font-black tabular-nums text-cyan-100 sm:text-4xl">
                            {formatPoolSharePercent(row.poolSharePercent)}
                          </p>
                        </div>
                        <div className="relative overflow-hidden rounded-2xl border border-emerald-300/30 bg-gradient-to-br from-emerald-400/20 via-emerald-500/10 to-amber-400/10 p-4 shadow-[0_15px_45px_-25px_rgba(16,185,129,0.7)] sm:p-5">
                          <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-emerald-200 sm:text-xs">
                            <span aria-hidden>💰</span> Est. Robux
                          </div>
                          <div className="mt-2 flex items-center gap-2">
                            <Image
                              src="/Robux_2019_Logo_white.svg.png"
                              alt=""
                              width={28}
                              height={28}
                              className="size-6 shrink-0 drop-shadow-[0_0_8px_rgba(16,185,129,0.6)] sm:size-7"
                            />
                            <p className="truncate bg-gradient-to-r from-emerald-200 via-emerald-100 to-amber-100 bg-clip-text text-2xl font-black tabular-nums text-transparent sm:text-3xl">
                              {formatChallengeRobux(row.estimatedPayoutRobux)}
                            </p>
                          </div>
                        </div>
                      </div>

                      {brandPick ? (
                        <div className="relative overflow-hidden rounded-2xl border border-violet-300/40 bg-gradient-to-r from-violet-500/20 via-fuchsia-500/15 to-amber-400/15 p-4 shadow-[0_15px_45px_-25px_rgba(168,85,247,0.7)] sm:p-5">
                          <div className="flex items-center gap-3">
                            <span className="text-3xl sm:text-4xl" aria-hidden>
                              👟
                            </span>
                            <div>
                              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-violet-200 sm:text-xs">
                                VF Brand sponsor
                              </p>
                              <p className="mt-0.5 text-base font-bold text-white sm:text-lg">
                                Top {row.rank} · sponsored boot pick
                              </p>
                            </div>
                          </div>
                        </div>
                      ) : null}
                    </div>

                    <details className="group/d relative border-t border-white/10 bg-black/20">
                      <summary className="flex cursor-pointer list-none items-center justify-between px-5 py-4 text-sm font-semibold text-white/80 transition hover:bg-white/[0.04] hover:text-white sm:px-7 sm:py-4 sm:text-base">
                        <span className="inline-flex items-center gap-2">
                          <span aria-hidden>📂</span>
                          View posts ({row.postCount})
                        </span>
                        <span className="text-white/40 transition group-open/d:rotate-180" aria-hidden>
                          ▾
                        </span>
                      </summary>
                      <ul className="space-y-1 border-t border-white/10 px-5 pb-4 pt-3 sm:px-7 sm:pb-5 sm:pt-4">
                        {row.posts.map((p) => {
                          const dateLabel = formatPostedDate(p.posted_at);
                          const viewsLabel =
                            typeof p.view_count === "number"
                              ? formatViewCount(p.view_count)
                              : null;
                          return (
                            <li
                              key={`${row.id}-${p.posted_at}-${p.url}`}
                              className="flex flex-col gap-1 border-b border-white/[0.06] py-3 last:border-b-0 last:pb-1 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:py-2.5"
                            >
                              <a
                                href={p.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="font-medium text-sky-200 underline-offset-2 hover:underline"
                              >
                                {postHostLabel(p.url)}
                                {dateLabel ? (
                                  <span className="ml-2 text-xs font-normal text-white/45">
                                    {dateLabel}
                                  </span>
                                ) : null}
                              </a>
                              <span className="text-xs tabular-nums text-white/55">
                                {viewsLabel ? (
                                  <>
                                    <span className="font-semibold text-white/80">
                                      {viewsLabel}
                                    </span>{" "}
                                    {p.views_source === "tiktok"
                                      ? "plays"
                                      : "views"}
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
                  {placeholderRanks.map((rank) => (
                    <article
                      key={`placeholder-${rank}`}
                      className="group/p relative overflow-hidden rounded-3xl border border-dashed border-white/15 bg-white/[0.02] backdrop-blur-sm transition hover:border-white/30 hover:bg-white/[0.04]"
                    >
                      <div className="flex items-center gap-4 p-5 sm:gap-6 sm:p-6">
                        <span className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-white/[0.06] text-xl font-black tabular-nums text-white/55 sm:size-16 sm:rounded-3xl sm:text-2xl">
                          #{rank}
                        </span>
                        <div className="flex size-14 shrink-0 items-center justify-center rounded-2xl border border-dashed border-white/15 bg-white/[0.02] text-2xl text-white/35 sm:size-16 sm:text-3xl">
                          ?
                        </div>
                        <div className="min-w-0 flex-1 space-y-1.5">
                          <p className="text-base font-bold text-white/75 sm:text-lg md:text-xl">
                            Open slot · rank #{rank}
                          </p>
                          <p className="text-xs leading-relaxed text-white/55 sm:text-sm sm:leading-relaxed">
                            {rank <= 3
                              ? "Top 3 → claim a VF Brand sponsored boot 👟 and the biggest Robux share."
                              : "Post a VF video and run /posted to lock in this spot."}
                          </p>
                          <Link
                            href="/content/creators/onboard"
                            className="mt-1.5 inline-flex text-xs font-bold text-amber-200 underline-offset-2 hover:text-amber-100 hover:underline sm:hidden"
                          >
                            Apply →
                          </Link>
                        </div>
                        <Link
                          href="/content/creators/onboard"
                          className="hidden shrink-0 rounded-xl border border-amber-300/40 bg-amber-400/15 px-4 py-2 text-sm font-bold text-amber-100 transition hover:border-amber-300/70 hover:bg-amber-400/25 hover:text-white sm:inline-flex"
                        >
                          Apply
                        </Link>
                      </div>
                    </article>
                  ))}
                </>
              );
            })()}
          </div>
        </section>

        {/* Quick stats */}
        <section className="mt-8 grid gap-4 sm:mt-12 sm:grid-cols-3">
          <div className="relative overflow-hidden rounded-2xl border border-sky-300/25 bg-gradient-to-br from-sky-500/10 via-white/[0.03] to-transparent p-5 shadow-[0_20px_50px_-30px_rgba(14,165,233,0.5)]">
            <div className="flex items-center gap-2 text-sky-200">
              <span className="text-2xl" aria-hidden>
                🎬
              </span>
              <span className="text-xs font-bold uppercase tracking-[0.14em]">
                Posts live
              </span>
            </div>
            <p className="mt-3 text-4xl font-black tabular-nums text-white sm:text-5xl">
              {challenge.totalPostCount}
            </p>
            <p className="mt-1.5 text-xs text-white/55 sm:text-sm">
              {challenge.participantCount} creators with links
            </p>
          </div>
          <div className="relative overflow-hidden rounded-2xl border border-violet-300/25 bg-gradient-to-br from-violet-500/10 via-white/[0.03] to-transparent p-5 shadow-[0_20px_50px_-30px_rgba(139,92,246,0.5)]">
            <div className="flex items-center gap-2 text-violet-200">
              <span className="text-2xl" aria-hidden>
                👥
              </span>
              <span className="text-xs font-bold uppercase tracking-[0.14em]">
                On leaderboard
              </span>
            </div>
            <p className="mt-3 text-4xl font-black tabular-nums text-white sm:text-5xl">
              {challenge.leaderboard.length}
            </p>
            <p className="mt-1.5 text-xs text-white/55 sm:text-sm">
              At least one challenge post
            </p>
          </div>
          <div className="relative overflow-hidden rounded-2xl border border-amber-300/30 bg-gradient-to-br from-amber-500/15 via-orange-500/10 to-transparent p-5 shadow-[0_20px_50px_-30px_rgba(251,146,60,0.55)]">
            <div className="flex items-center gap-2 text-amber-200">
              <span className="text-2xl" aria-hidden>
                👟
              </span>
              <span className="text-xs font-bold uppercase tracking-[0.14em]">
                VF Brand top 3
              </span>
            </div>
            <p className="mt-3 bg-gradient-to-r from-amber-200 to-orange-300 bg-clip-text text-2xl font-black text-transparent sm:text-3xl">
              Sponsored boots
            </p>
            <p className="mt-1.5 text-xs text-white/55 sm:text-sm">
              Highest view totals (staff confirm)
            </p>
          </div>
        </section>

        <section
          id="how-it-works"
          className="relative mt-10 scroll-mt-24 overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03] p-5 shadow-[0_30px_80px_-30px_rgba(80,140,255,0.4)] backdrop-blur-xl sm:mt-12 sm:p-9"
        >
          <div className="space-y-2">
            <p className="inline-flex items-center gap-2 rounded-full border border-cyan-300/40 bg-cyan-400/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-100">
              <span aria-hidden>📘</span> New here? Start here
            </p>
            <h2 className="text-2xl font-black tracking-tight text-white sm:text-3xl">
              VF Create · the full beginner guide
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-white/70 sm:text-base">
              VF Create is the Virtual Football content program. You make
              short videos about VF — clips, montages, reactions, guides — post
              them on TikTok and/or YouTube, then log the link with our Discord
              bot. The community is racing to{" "}
              <strong className="text-white">1,000,000 combined views</strong>{" "}
              and unlocking a{" "}
              <strong className="text-emerald-200">
                {formatChallengeRobux(ROAD_TO_1M_PRIZE_POOL_ROBUX)}
              </strong>{" "}
              pool. No prior experience required — this guide walks you through
              every step.
            </p>
          </div>

          <ol className="mt-6 space-y-4 text-sm leading-relaxed text-white/75 sm:mt-7 sm:space-y-5 sm:text-[15px]">
            <li className="flex gap-3.5">
              <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-sky-400 to-indigo-600 text-sm font-black text-white shadow-[0_8px_24px_-8px_rgba(99,102,241,0.7)]">
                1
              </span>
              <div>
                <p className="text-base font-bold text-white sm:text-lg">
                  <span aria-hidden className="mr-1.5">✅</span>Get approved as a VF Creator
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

            <li className="flex gap-3.5">
              <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-pink-400 to-rose-600 text-sm font-black text-white shadow-[0_8px_24px_-8px_rgba(236,72,153,0.7)]">
                2
              </span>
              <div>
                <p className="text-base font-bold text-white sm:text-lg">
                  <span aria-hidden className="mr-1.5">🎥</span>Make a VF video and post it publicly
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

            <li className="flex gap-3.5">
              <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-400 to-fuchsia-600 text-sm font-black text-white shadow-[0_8px_24px_-8px_rgba(168,85,247,0.7)]">
                3
              </span>
              <div>
                <p className="text-base font-bold text-white sm:text-lg">
                  <span aria-hidden className="mr-1.5">🤖</span>Log it with{" "}
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

            <li className="flex gap-3.5">
              <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-400 to-blue-600 text-sm font-black text-white shadow-[0_8px_24px_-8px_rgba(56,189,248,0.7)]">
                4
              </span>
              <div>
                <p className="text-base font-bold text-white sm:text-lg">
                  <span aria-hidden className="mr-1.5">🔄</span>Views sync automatically — and you can force a refresh
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

            <li className="flex gap-3.5">
              <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-400 to-green-600 text-sm font-black text-white shadow-[0_8px_24px_-8px_rgba(16,185,129,0.7)]">
                5
              </span>
              <div>
                <p className="text-base font-bold text-white sm:text-lg">
                  <span aria-hidden className="mr-1.5">💰</span>How the {formatChallengeRobux(ROAD_TO_1M_PRIZE_POOL_ROBUX)}
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

            <li className="flex gap-3.5">
              <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-amber-300 to-orange-600 text-sm font-black text-white shadow-[0_8px_24px_-8px_rgba(251,146,60,0.7)]">
                6
              </span>
              <div>
                <p className="text-base font-bold text-white sm:text-lg">
                  <span aria-hidden className="mr-1.5">👟</span>Top 3 also win VF Brand sponsored boots
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

            <li className="flex gap-3.5">
              <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-xl bg-white/10 text-sm font-black text-white/85 ring-1 ring-white/15">
                ?
              </span>
              <div>
                <p className="text-base font-bold text-white sm:text-lg">
                  <span aria-hidden className="mr-1.5">💬</span>Quick FAQ for new creators
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

          <div className="mt-7 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl border border-amber-300/30 bg-gradient-to-r from-amber-400/15 via-pink-400/10 to-violet-400/15 px-4 py-3 text-sm text-white shadow-[0_15px_45px_-25px_rgba(251,146,60,0.55)] sm:mt-8 sm:px-5 sm:py-4">
            <span className="text-2xl" aria-hidden>
              🚀
            </span>
            <span className="font-bold text-white">Ready to start?</span>
            <Link
              href="/content/creators/onboard"
              className="rounded-xl bg-gradient-to-r from-amber-300 to-orange-500 px-4 py-2 text-sm font-black text-amber-950 shadow-[0_10px_30px_-10px_rgba(251,146,60,0.7)] transition hover:scale-[1.03] hover:shadow-[0_12px_36px_-10px_rgba(251,146,60,0.85)]"
            >
              Apply as a creator →
            </Link>
            <span className="text-white/60">or</span>
            <Link
              href="/content/creators/vf-brand"
              className="text-sm font-semibold text-violet-200 underline-offset-2 hover:text-white hover:underline"
            >
              See the VF Brand prize boots 👟
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
