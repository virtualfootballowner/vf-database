import { extractYoutubeVideoId, normalizeTiktokUrlKey } from "@/lib/creator-onboard/posted-video-url-platform";

export const DEFAULT_APIFY_YOUTUBE_ACTOR = "happy_b~youtube-video-scraper";
export const DEFAULT_APIFY_TIKTOK_ACTOR = "clockworks~tiktok-scraper";

const APIFY_BASE = "https://api.apify.com/v2";

type YoutubeDatasetItem = { videoId?: string; viewCount?: number };
type TiktokDatasetItem = { webVideoUrl?: string; playCount?: number };

async function runSyncDatasetItems(
  actorId: string,
  token: string,
  input: Record<string, unknown>,
  timeoutSec: number,
): Promise<unknown[]> {
  const q = new URLSearchParams({ timeout: String(timeoutSec) });
  const url = `${APIFY_BASE}/acts/${encodeURIComponent(actorId)}/run-sync-get-dataset-items?${q}`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });

  const text = await res.text();
  if (!res.ok) {
    let detail = text.slice(0, 400);
    try {
      const j = JSON.parse(text) as { error?: { message?: string } };
      if (j.error?.message) detail = j.error.message;
    } catch {
      /* keep text */
    }
    throw new Error(`Apify ${actorId}: ${res.status} ${detail}`);
  }

  try {
    const data = JSON.parse(text) as unknown;
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

/** Map YouTube videoId → view count (batched Apify run). */
export async function fetchYoutubeViewCounts(
  videoUrls: string[],
  token: string,
  actorId: string = DEFAULT_APIFY_YOUTUBE_ACTOR,
): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  const unique = [...new Set(videoUrls.map((u) => u.trim()).filter(Boolean))];
  if (unique.length === 0) return out;

  const items = (await runSyncDatasetItems(
    actorId,
    token,
    {
      videoUrls: unique,
      includeChannelInfo: false,
    },
    300,
  )) as YoutubeDatasetItem[];

  for (const it of items) {
    const id = typeof it.videoId === "string" ? it.videoId.trim() : "";
    const vc = it.viewCount;
    if (id && typeof vc === "number" && Number.isFinite(vc) && vc >= 0) {
      out.set(id, Math.floor(vc));
    }
  }
  return out;
}

/** Map normalized TikTok video URL → play count (batched Apify run). */
export async function fetchTiktokPlayCounts(
  postURLs: string[],
  token: string,
  actorId: string = DEFAULT_APIFY_TIKTOK_ACTOR,
): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  const unique = [...new Set(postURLs.map((u) => u.trim()).filter(Boolean))];
  if (unique.length === 0) return out;

  const items = (await runSyncDatasetItems(
    actorId,
    token,
    {
      postURLs: unique,
      resultsPerPage: 1,
      scrapeRelatedVideos: false,
      shouldDownloadVideos: false,
      shouldDownloadCovers: false,
      shouldDownloadSlideshowImages: false,
      shouldDownloadAvatars: false,
      shouldDownloadMusicCovers: false,
      commentsPerPost: 0,
      topLevelCommentsPerPost: 0,
      maxRepliesPerComment: 0,
      proxyCountryCode: "None",
    },
    300,
  )) as TiktokDatasetItem[];

  for (const it of items) {
    const u = typeof it.webVideoUrl === "string" ? it.webVideoUrl.trim() : "";
    const pc = it.playCount;
    if (!u || typeof pc !== "number" || !Number.isFinite(pc) || pc < 0) continue;
    const key = normalizeTiktokUrlKey(u);
    out.set(key, Math.floor(pc));
    try {
      out.set(new URL(u).href.toLowerCase(), Math.floor(pc));
    } catch {
      /* ignore */
    }
  }
  return out;
}

export function lookupYoutubeViews(
  url: string,
  byVideoId: Map<string, number>,
): number | undefined {
  const id = extractYoutubeVideoId(url);
  if (!id) return undefined;
  return byVideoId.get(id);
}

export function lookupTiktokViews(
  url: string,
  byUrlKey: Map<string, number>,
): number | undefined {
  const a = normalizeTiktokUrlKey(url);
  if (byUrlKey.has(a)) return byUrlKey.get(a);
  try {
    return byUrlKey.get(new URL(url).href.toLowerCase());
  } catch {
    return undefined;
  }
}
