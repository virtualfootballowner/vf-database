import type { SupabaseClient } from "@supabase/supabase-js";

import {
  fetchTiktokPlayCounts,
  fetchYoutubeViewCounts,
  lookupTiktokViews,
  lookupYoutubeViews,
} from "@/lib/creator-onboard/apify-video-views";
import {
  parsePostedVideoLinks,
  type PostedVideoLink,
} from "@/lib/creator-onboard/approved-creators-directory";
import type { CreatorWebEnv } from "@/lib/creator-onboard/env-web";
import { classifyPostedVideoUrl } from "@/lib/creator-onboard/posted-video-url-platform";
import { createCreatorSupabaseAdmin } from "@/lib/creator-onboard/supabase-creator";

export type SyncPostedVideoViewsResult = {
  applicationsConsidered: number;
  applicationsUpdated: number;
  youtubeUrls: number;
  tiktokUrls: number;
  otherUrls: number;
  youtubeError: string | null;
  tiktokError: string | null;
};

/** Service-role Supabase client (e.g. from the bot or Next.js cron). */
export async function syncPostedVideoViewsWithSupabase(opts: {
  supabase: SupabaseClient;
  apifyToken: string;
  youtubeActorId?: string;
  tiktokActorId?: string;
}): Promise<SyncPostedVideoViewsResult> {
  const result: SyncPostedVideoViewsResult = {
    applicationsConsidered: 0,
    applicationsUpdated: 0,
    youtubeUrls: 0,
    tiktokUrls: 0,
    otherUrls: 0,
    youtubeError: null,
    tiktokError: null,
  };

  const { supabase } = opts;
  const { data: rows, error } = await supabase
    .from("creator_applications")
    .select("id, posted_video_links")
    .eq("status", "approved");

  if (error) {
    throw error;
  }

  const list = (rows ?? []) as Array<{
    id: string;
    posted_video_links: unknown;
  }>;

  const youtubeUrls = new Set<string>();
  const tiktokUrls = new Set<string>();

  for (const row of list) {
    const links = parsePostedVideoLinks(row.posted_video_links);
    if (links.length === 0) continue;
    result.applicationsConsidered += 1;
    for (const link of links) {
      const p = classifyPostedVideoUrl(link.url);
      if (p === "youtube") {
        youtubeUrls.add(link.url);
      } else if (p === "tiktok") {
        tiktokUrls.add(link.url);
      } else {
        result.otherUrls += 1;
      }
    }
  }

  result.youtubeUrls = youtubeUrls.size;
  result.tiktokUrls = tiktokUrls.size;

  let youtubeMap = new Map<string, number>();
  let tiktokMap = new Map<string, number>();

  const ranYoutube = youtubeUrls.size > 0;
  const ranTiktok = tiktokUrls.size > 0;

  if (ranYoutube) {
    try {
      youtubeMap = await fetchYoutubeViewCounts(
        [...youtubeUrls],
        opts.apifyToken,
        opts.youtubeActorId,
      );
    } catch (e) {
      result.youtubeError =
        e instanceof Error ? e.message : "YouTube Apify run failed";
      console.error("[creator-views] YouTube Apify:", e);
    }
  }

  if (ranTiktok) {
    try {
      tiktokMap = await fetchTiktokPlayCounts(
        [...tiktokUrls],
        opts.apifyToken,
        opts.tiktokActorId,
      );
    } catch (e) {
      result.tiktokError =
        e instanceof Error ? e.message : "TikTok Apify run failed";
      console.error("[creator-views] TikTok Apify:", e);
    }
  }

  const fetchedAt = new Date().toISOString();

  for (const row of list) {
    const links = parsePostedVideoLinks(row.posted_video_links);
    if (links.length === 0) continue;

    let changed = false;
    const next: PostedVideoLink[] = links.map((link) => {
      const platform = classifyPostedVideoUrl(link.url);
      const base = { ...link };

      if (platform === "youtube") {
        if (!ranYoutube) {
          return base;
        }
        if (result.youtubeError) {
          return {
            ...base,
            views_error: result.youtubeError.slice(0, 500),
            views_fetched_at: fetchedAt,
          };
        }
        const v = lookupYoutubeViews(link.url, youtubeMap);
        if (v != null) {
          changed = true;
          return {
            ...base,
            view_count: v,
            views_fetched_at: fetchedAt,
            views_source: "youtube" as const,
            views_error: undefined,
          };
        }
        return {
          ...base,
          views_error: "YouTube: no metrics returned for this URL",
          views_fetched_at: fetchedAt,
        };
      }

      if (platform === "tiktok") {
        if (!ranTiktok) {
          return base;
        }
        if (result.tiktokError) {
          return {
            ...base,
            views_error: result.tiktokError.slice(0, 500),
            views_fetched_at: fetchedAt,
          };
        }
        const v = lookupTiktokViews(link.url, tiktokMap);
        if (v != null) {
          changed = true;
          return {
            ...base,
            view_count: v,
            views_fetched_at: fetchedAt,
            views_source: "tiktok" as const,
            views_error: undefined,
          };
        }
        return {
          ...base,
          views_error: "TikTok: no metrics returned for this URL",
          views_fetched_at: fetchedAt,
        };
      }

      return base;
    });

    const anyMeta = next.some((l) => l.views_fetched_at === fetchedAt);
    if (!anyMeta) continue;

    const { error: upErr } = await supabase
      .from("creator_applications")
      .update({
        posted_video_links: next,
        updated_at: fetchedAt,
      })
      .eq("id", row.id);

    if (upErr) {
      console.error("[creator-views] update row", row.id, upErr);
      continue;
    }
    if (changed || next.some((l) => l.views_fetched_at === fetchedAt)) {
      result.applicationsUpdated += 1;
    }
  }

  return result;
}

export async function syncPostedVideoViewsForAllApproved(opts: {
  env: CreatorWebEnv;
  apifyToken: string;
  youtubeActorId?: string;
  tiktokActorId?: string;
}): Promise<SyncPostedVideoViewsResult> {
  const supabase = createCreatorSupabaseAdmin(opts.env);
  return syncPostedVideoViewsWithSupabase({
    supabase,
    apifyToken: opts.apifyToken,
    youtubeActorId: opts.youtubeActorId,
    tiktokActorId: opts.tiktokActorId,
  });
}
