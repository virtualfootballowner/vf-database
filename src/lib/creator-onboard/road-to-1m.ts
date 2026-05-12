import type {
  ApprovedCreatorDirectoryRow,
  PostedVideoLink,
} from "@/lib/creator-onboard/approved-creators-directory";

/** Community milestone (aggregate tracked views / plays). */
export const ROAD_TO_1M_TARGET_VIEWS = 1_000_000;

/** Total Robux split proportionally by tracked views at payout. */
export const ROAD_TO_1M_PRIZE_POOL_ROBUX = 50_000;

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
  estimatedPayoutRobux: number;
  posts: PostedVideoLink[];
};

export type RoadTo1MChallenge = {
  targetViews: number;
  prizePoolRobux: number;
  totalTrackedViews: number;
  progressPercent: number;
  milestoneReached: boolean;
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
 * Proportional pool: each creator’s estimated Robux = (their views / total views) × pool.
 * When aggregate hits 1M, 100k views ≈ 10% ≈ 5k of 50k Robux.
 */
export function buildRoadTo1MChallenge(
  creators: ApprovedCreatorDirectoryRow[],
): RoadTo1MChallenge {
  const targetViews = ROAD_TO_1M_TARGET_VIEWS;
  const prizePoolRobux = ROAD_TO_1M_PRIZE_POOL_ROBUX;

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
      const estimatedPayoutRobux = (r.totalViews / denominator) * prizePoolRobux;
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
        estimatedPayoutRobux,
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
    prizePoolRobux,
    totalTrackedViews,
    progressPercent,
    milestoneReached,
    participantCount,
    totalPostCount,
    leaderboard,
  };
}

export function formatChallengeRobux(n: number): string {
  if (!Number.isFinite(n)) return "0";
  const rounded = Math.round(n);
  const formatted = new Intl.NumberFormat(undefined).format(rounded);
  return `${formatted} Robux`;
}

export function formatPoolSharePercent(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return "0%";
  if (n >= 10) return `${n.toFixed(1)}%`;
  return `${n.toFixed(2)}%`;
}
