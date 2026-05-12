import type {
  ApprovedCreatorDirectoryRow,
  PostedVideoLink,
} from "@/lib/creator-onboard/approved-creators-directory";

/** Community milestone (aggregate tracked views / plays). */
export const ROAD_TO_1M_TARGET_VIEWS = 1_000_000;

/** Total USD split proportionally by tracked views at payout. */
export const ROAD_TO_1M_PRIZE_POOL_USD = 5_000;

export type ChallengeLeaderboardEntry = {
  rank: number;
  id: string;
  displayName: string;
  robloxUsername: string;
  robloxAvatarUrl: string | null;
  country: string | null;
  approvedAt: string;
  postCount: number;
  postsWithMetrics: number;
  totalViews: number;
  /** Share of current pool (sums to ~100% across rows). */
  poolSharePercent: number;
  estimatedPayoutUsd: number;
  posts: PostedVideoLink[];
};

export type RoadTo1MChallenge = {
  targetViews: number;
  prizePoolUsd: number;
  totalTrackedViews: number;
  /** 0–100 for UI bar (capped at 100 for display). */
  progressPercent: number;
  milestoneReached: boolean;
  /** Creators with at least one posted link. */
  participantCount: number;
  totalPostCount: number;
  leaderboard: ChallengeLeaderboardEntry[];
};

function sumPostViews(links: PostedVideoLink[]): {
  total: number;
  withMetrics: number;
} {
  let total = 0;
  let withMetrics = 0;
  for (const p of links) {
    if (typeof p.view_count === "number" && Number.isFinite(p.view_count)) {
      total += p.view_count;
      withMetrics += 1;
    }
  }
  return { total, withMetrics };
}

/**
 * Proportional pool: each creator’s estimated $ share = (their views / total views) × pool.
 * When aggregate hits 1M, 100k views ≈ 10% ≈ $500 of $5k.
 */
export function buildRoadTo1MChallenge(
  creators: ApprovedCreatorDirectoryRow[],
): RoadTo1MChallenge {
  const targetViews = ROAD_TO_1M_TARGET_VIEWS;
  const prizePoolUsd = ROAD_TO_1M_PRIZE_POOL_USD;

  let totalTrackedViews = 0;
  let totalPostCount = 0;
  let participantCount = 0;

  type Row = {
    id: string;
    displayName: string;
    robloxUsername: string;
    robloxAvatarUrl: string | null;
    country: string | null;
    approvedAt: string;
    postCount: number;
    postsWithMetrics: number;
    totalViews: number;
    posts: PostedVideoLink[];
  };

  const rows: Row[] = [];

  for (const c of creators) {
    const posts = [...(c.posted_video_links ?? [])].sort(
      (a, b) =>
        new Date(b.posted_at).getTime() - new Date(a.posted_at).getTime(),
    );
    if (posts.length === 0) continue;

    participantCount += 1;
    totalPostCount += posts.length;
    const { total, withMetrics } = sumPostViews(posts);
    totalTrackedViews += total;

    const displayName =
      c.discord_username?.trim() || c.roblox_username || "Creator";

    rows.push({
      id: c.id,
      displayName,
      robloxUsername: c.roblox_username,
      robloxAvatarUrl: c.roblox_avatar_url,
      country: c.country,
      approvedAt: c.approved_at,
      postCount: posts.length,
      postsWithMetrics: withMetrics,
      totalViews: total,
      posts,
    });
  }

  const denominator = Math.max(totalTrackedViews, 1);

  const leaderboard: ChallengeLeaderboardEntry[] = rows
    .map((r) => {
      const poolSharePercent = (r.totalViews / denominator) * 100;
      const estimatedPayoutUsd = (r.totalViews / denominator) * prizePoolUsd;
      return {
        rank: 0,
        id: r.id,
        displayName: r.displayName,
        robloxUsername: r.robloxUsername,
        robloxAvatarUrl: r.robloxAvatarUrl,
        country: r.country,
        approvedAt: r.approvedAt,
        postCount: r.postCount,
        postsWithMetrics: r.postsWithMetrics,
        totalViews: r.totalViews,
        poolSharePercent,
        estimatedPayoutUsd,
        posts: r.posts,
      };
    })
    .sort((a, b) => {
      if (b.totalViews !== a.totalViews) return b.totalViews - a.totalViews;
      return (
        new Date(a.approvedAt).getTime() - new Date(b.approvedAt).getTime()
      );
    })
    .map((e, i) => ({ ...e, rank: i + 1 }));

  const rawProgress = (totalTrackedViews / targetViews) * 100;
  const progressPercent = Math.min(100, rawProgress);
  const milestoneReached = totalTrackedViews >= targetViews;

  return {
    targetViews,
    prizePoolUsd,
    totalTrackedViews,
    progressPercent,
    milestoneReached,
    participantCount,
    totalPostCount,
    leaderboard,
  };
}

export function formatChallengeUsd(n: number): string {
  if (!Number.isFinite(n)) return "$0";
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: n >= 100 ? 0 : 2,
  }).format(n);
}

export function formatPoolSharePercent(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return "0%";
  if (n >= 10) return `${n.toFixed(1)}%`;
  return `${n.toFixed(2)}%`;
}
