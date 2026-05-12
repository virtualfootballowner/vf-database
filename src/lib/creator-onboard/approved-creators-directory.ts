import { createCreatorSupabaseAdmin } from "@/lib/creator-onboard/supabase-creator";
import type { CreatorWebEnv } from "@/lib/creator-onboard/env-web";

export type PostedVideoLink = {
  url: string;
  posted_at: string;
  /** Latest known view/play count from daily sync (YouTube views, TikTok plays). */
  view_count?: number;
  views_fetched_at?: string;
  views_source?: "youtube" | "tiktok" | "apify";
  /** Set when the last sync failed for this URL. */
  views_error?: string;
};

/** Normalize JSONB from Postgres for directory + bot handlers. */
export function parsePostedVideoLinks(value: unknown): PostedVideoLink[] {
  if (!Array.isArray(value)) return [];
  const out: PostedVideoLink[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const url = typeof o.url === "string" ? o.url.trim() : "";
    const posted_at =
      typeof o.posted_at === "string" ? o.posted_at.trim() : "";
    if (!url || !posted_at) continue;

    const link: PostedVideoLink = { url, posted_at };
    if (typeof o.view_count === "number" && Number.isFinite(o.view_count)) {
      link.view_count = Math.max(0, Math.floor(o.view_count));
    }
    if (typeof o.views_fetched_at === "string" && o.views_fetched_at.trim()) {
      link.views_fetched_at = o.views_fetched_at.trim();
    }
    if (typeof o.views_error === "string" && o.views_error.trim()) {
      link.views_error = o.views_error.trim();
    }
    if (o.views_source === "youtube" || o.views_source === "tiktok") {
      link.views_source = o.views_source;
    }
    out.push(link);
  }
  return out;
}

export type ApprovedCreatorDirectoryRow = {
  id: string;
  discord_username: string | null;
  roblox_username: string;
  roblox_avatar_url: string | null;
  tiktok_handle: string | null;
  youtube_handle: string | null;
  country: string | null;
  approved_at: string;
  posted_video_links: PostedVideoLink[];
};

/** Public-safe fields only — no email, age, or discord_id. */
export async function listApprovedCreatorsForDirectory(
  env: CreatorWebEnv,
): Promise<ApprovedCreatorDirectoryRow[]> {
  const supabase = createCreatorSupabaseAdmin(env);
  const { data, error } = await supabase
    .from("creator_applications")
    .select(
      "id, discord_username, roblox_username, roblox_avatar_url, tiktok_handle, youtube_handle, country, approved_at, posted_video_links",
    )
    .eq("status", "approved")
    .order("approved_at", { ascending: false });

  if (error) {
    console.error("[creator] directory list:", error);
    return [];
  }

  const rows = (data ?? []) as Array<
    Omit<ApprovedCreatorDirectoryRow, "posted_video_links"> & {
      posted_video_links: unknown;
    }
  >;

  return rows.map((r) => ({
    ...r,
    posted_video_links: parsePostedVideoLinks(r.posted_video_links),
  }));
}
