import {
  extractYoutubeVideoId,
  normalizeTiktokUrlKey,
} from "@/lib/creator-onboard/posted-video-url-platform";

export const DEFAULT_APIFY_YOUTUBE_ACTOR = "happy_b~youtube-video-scraper";
export const FALLBACK_APIFY_YOUTUBE_ACTOR = "streamers~youtube-scraper";

export const DEFAULT_APIFY_TIKTOK_ACTOR = "clockworks~tiktok-scraper";
export const FALLBACK_APIFY_TIKTOK_ACTOR = "dltik~tiktok-scraper";

const APIFY_BASE = "https://api.apify.com/v2";

type YoutubeActorKind = "happy_b" | "streamers";
type TiktokActorKind = "clockworks" | "dltik";

function youtubeKindForActor(actorId: string): YoutubeActorKind {
  const id = actorId.trim().toLowerCase();
  if (
    id === FALLBACK_APIFY_YOUTUBE_ACTOR.toLowerCase() ||
    id.includes("streamers")
  ) {
    return "streamers";
  }
  return "happy_b";
}

function tiktokKindForActor(actorId: string): TiktokActorKind {
  const id = actorId.trim().toLowerCase();
  if (id === FALLBACK_APIFY_TIKTOK_ACTOR.toLowerCase() || id.includes("dltik")) {
    return "dltik";
  }
  return "clockworks";
}

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

function youtubeInput(kind: YoutubeActorKind, urls: string[]): Record<string, unknown> {
  if (kind === "streamers") {
    return {
      startUrls: urls.map((url) => ({ url })),
      maxResults: 1,
      maxResultsShorts: 0,
      maxResultStreams: 0,
    };
  }
  return {
    videoUrls: urls,
    includeChannelInfo: false,
  };
}

function tiktokInput(kind: TiktokActorKind, urls: string[]): Record<string, unknown> {
  if (kind === "dltik") {
    return {
      inputs: urls,
      maxResultsPerInput: 1,
    };
  }
  return {
    postURLs: urls,
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
  };
}

function parseYoutubeItems(
  items: unknown[],
  kind: YoutubeActorKind,
): Map<string, number> {
  const out = new Map<string, number>();
  for (const raw of items) {
    if (!raw || typeof raw !== "object") continue;
    const it = raw as Record<string, unknown>;
    const id =
      (typeof it.videoId === "string" ? it.videoId : null) ??
      (typeof it.id === "string" ? it.id : null);
    const vc = it.viewCount ?? it.views;
    if (
      id &&
      typeof vc === "number" &&
      Number.isFinite(vc) &&
      vc >= 0
    ) {
      out.set(id.trim(), Math.floor(vc));
    }
    if (kind === "streamers" && typeof it.url === "string") {
      const vid = extractYoutubeVideoId(it.url);
      if (vid && typeof vc === "number" && Number.isFinite(vc) && vc >= 0) {
        out.set(vid, Math.floor(vc));
      }
    }
  }
  return out;
}

function pickTiktokUrlFromItem(it: Record<string, unknown>): string | null {
  for (const key of [
    "webVideoUrl",
    "url",
    "videoUrl",
    "shareUrl",
    "link",
  ]) {
    const v = it[key];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return null;
}

function pickTiktokPlayCount(it: Record<string, unknown>): number | null {
  for (const key of ["playCount", "views", "viewCount", "play_count"]) {
    const v = it[key];
    if (typeof v === "number" && Number.isFinite(v) && v >= 0) {
      return Math.floor(v);
    }
  }
  const stats = it.stats;
  if (stats && typeof stats === "object") {
    const s = stats as Record<string, unknown>;
    for (const key of ["playCount", "views", "viewCount"]) {
      const v = s[key];
      if (typeof v === "number" && Number.isFinite(v) && v >= 0) {
        return Math.floor(v);
      }
    }
  }
  return null;
}

function parseTiktokItems(items: unknown[], _kind: TiktokActorKind): Map<string, number> {
  const out = new Map<string, number>();
  for (const raw of items) {
    if (!raw || typeof raw !== "object") continue;
    const it = raw as Record<string, unknown>;
    const u = pickTiktokUrlFromItem(it);
    const pc = pickTiktokPlayCount(it);
    if (!u || pc == null) continue;
    const key = normalizeTiktokUrlKey(u);
    out.set(key, pc);
    try {
      out.set(new URL(u).href.toLowerCase(), pc);
    } catch {
      /* ignore */
    }
  }
  return out;
}

function mergeViewMaps(
  target: Map<string, number>,
  source: Map<string, number>,
): void {
  for (const [k, v] of source) {
    if (!target.has(k)) target.set(k, v);
  }
}

async function runYoutubeActor(
  actorId: string,
  kind: YoutubeActorKind,
  urls: string[],
  token: string,
): Promise<Map<string, number>> {
  const unique = [...new Set(urls.map((u) => u.trim()).filter(Boolean))];
  if (unique.length === 0) return new Map();
  const items = await runSyncDatasetItems(
    actorId,
    token,
    youtubeInput(kind, unique),
    300,
  );
  return parseYoutubeItems(items, kind);
}

async function runTiktokActor(
  actorId: string,
  kind: TiktokActorKind,
  urls: string[],
  token: string,
): Promise<Map<string, number>> {
  const unique = [...new Set(urls.map((u) => u.trim()).filter(Boolean))];
  if (unique.length === 0) return new Map();
  const items = await runSyncDatasetItems(
    actorId,
    token,
    tiktokInput(kind, unique),
    300,
  );
  return parseTiktokItems(items, kind);
}

function youtubeUrlsStillMissing(
  urls: string[],
  byVideoId: Map<string, number>,
): string[] {
  const missing: string[] = [];
  for (const url of urls) {
    if (lookupYoutubeViews(url, byVideoId) == null) missing.push(url);
  }
  return missing;
}

function tiktokUrlsStillMissing(
  urls: string[],
  byUrlKey: Map<string, number>,
): string[] {
  const missing: string[] = [];
  for (const url of urls) {
    if (lookupTiktokViews(url, byUrlKey) == null) missing.push(url);
  }
  return missing;
}

/**
 * Primary Apify actor, then fallback for URLs that failed or returned no metrics.
 */
export async function fetchYoutubeViewCounts(
  videoUrls: string[],
  token: string,
  primaryActorId: string = DEFAULT_APIFY_YOUTUBE_ACTOR,
  fallbackActorId: string = FALLBACK_APIFY_YOUTUBE_ACTOR,
): Promise<Map<string, number>> {
  const unique = [...new Set(videoUrls.map((u) => u.trim()).filter(Boolean))];
  if (unique.length === 0) return new Map();

  const primaryKind = youtubeKindForActor(primaryActorId);
  const fallbackKind = youtubeKindForActor(fallbackActorId);

  let merged = new Map<string, number>();
  let primaryFailed = false;

  try {
    const primary = await runYoutubeActor(
      primaryActorId,
      primaryKind,
      unique,
      token,
    );
    mergeViewMaps(merged, primary);
  } catch (e) {
    primaryFailed = true;
    console.error("[creator-views] YouTube primary actor failed:", e);
  }

  let missing = youtubeUrlsStillMissing(unique, merged);
  if (primaryFailed) missing = unique;

  if (
    missing.length > 0 &&
    fallbackActorId.trim() &&
    fallbackActorId.trim() !== primaryActorId.trim()
  ) {
    try {
      const fb = await runYoutubeActor(
        fallbackActorId,
        fallbackKind,
        missing,
        token,
      );
      mergeViewMaps(merged, fb);
      const still = youtubeUrlsStillMissing(missing, merged);
      if (still.length < missing.length) {
        console.log(
          `[creator-views] YouTube fallback (${fallbackActorId}) filled ${missing.length - still.length}/${missing.length} URL(s)`,
        );
      }
    } catch (e) {
      console.error("[creator-views] YouTube fallback actor failed:", e);
      if (primaryFailed) throw e;
    }
  }

  if (primaryFailed && merged.size === 0) {
    throw new Error(
      `YouTube: primary (${primaryActorId}) and fallback (${fallbackActorId}) failed`,
    );
  }

  return merged;
}

export async function fetchTiktokPlayCounts(
  postURLs: string[],
  token: string,
  primaryActorId: string = DEFAULT_APIFY_TIKTOK_ACTOR,
  fallbackActorId: string = FALLBACK_APIFY_TIKTOK_ACTOR,
): Promise<Map<string, number>> {
  const unique = [...new Set(postURLs.map((u) => u.trim()).filter(Boolean))];
  if (unique.length === 0) return new Map();

  const primaryKind = tiktokKindForActor(primaryActorId);
  const fallbackKind = tiktokKindForActor(fallbackActorId);

  let merged = new Map<string, number>();
  let primaryFailed = false;

  try {
    const primary = await runTiktokActor(
      primaryActorId,
      primaryKind,
      unique,
      token,
    );
    mergeViewMaps(merged, primary);
  } catch (e) {
    primaryFailed = true;
    console.error("[creator-views] TikTok primary actor failed:", e);
  }

  let missing = tiktokUrlsStillMissing(unique, merged);
  if (primaryFailed) missing = unique;

  if (
    missing.length > 0 &&
    fallbackActorId.trim() &&
    fallbackActorId.trim() !== primaryActorId.trim()
  ) {
    try {
      const fb = await runTiktokActor(
        fallbackActorId,
        fallbackKind,
        missing,
        token,
      );
      mergeViewMaps(merged, fb);
      const still = tiktokUrlsStillMissing(missing, merged);
      if (still.length < missing.length) {
        console.log(
          `[creator-views] TikTok fallback (${fallbackActorId}) filled ${missing.length - still.length}/${missing.length} URL(s)`,
        );
      }
    } catch (e) {
      console.error("[creator-views] TikTok fallback actor failed:", e);
      if (primaryFailed) throw e;
    }
  }

  if (primaryFailed && merged.size === 0) {
    throw new Error(
      `TikTok: primary (${primaryActorId}) and fallback (${fallbackActorId}) failed`,
    );
  }

  return merged;
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

/** Resolve primary + fallback actor ids from env (optional overrides). */
export function resolveApifyYoutubeActors(): {
  primary: string;
  fallback: string;
} {
  return {
    primary:
      process.env.APIFY_YOUTUBE_ACTOR_ID?.trim() || DEFAULT_APIFY_YOUTUBE_ACTOR,
    fallback:
      process.env.APIFY_YOUTUBE_FALLBACK_ACTOR_ID?.trim() ||
      FALLBACK_APIFY_YOUTUBE_ACTOR,
  };
}

export function resolveApifyTiktokActors(): {
  primary: string;
  fallback: string;
} {
  return {
    primary:
      process.env.APIFY_TIKTOK_ACTOR_ID?.trim() || DEFAULT_APIFY_TIKTOK_ACTOR,
    fallback:
      process.env.APIFY_TIKTOK_FALLBACK_ACTOR_ID?.trim() ||
      FALLBACK_APIFY_TIKTOK_ACTOR,
  };
}
