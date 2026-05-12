import {
  DEFAULT_APIFY_TIKTOK_ACTOR,
  DEFAULT_APIFY_YOUTUBE_ACTOR,
} from "@/lib/creator-onboard/apify-video-views";
import { loadCreatorWebEnv } from "@/lib/creator-onboard/env-web";
import { syncPostedVideoViewsForAllApproved } from "@/lib/creator-onboard/sync-posted-video-views";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

function unauthorized(): Response {
  return new Response("Unauthorized", { status: 401 });
}

/**
 * Daily job: refresh YouTube view counts + TikTok play counts for creator directory posts via Apify.
 *
 * Schedule: 12:00 UTC (`vercel.json` cron or GitHub Actions workflow).
 *
 * Trigger manually:
 *   curl -H "Authorization: Bearer $CRON_SECRET" https://your-domain/api/cron/sync-creator-post-views
 *
 * Or run **`/update-content`** in Discord (Manage Server + `APIFY_API_TOKEN` on the bot).
 */
export async function GET(req: Request): Promise<Response> {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) {
    return Response.json(
      { error: "CRON_SECRET is not configured" },
      { status: 500 },
    );
  }

  const auth = req.headers.get("authorization")?.trim();
  if (auth !== `Bearer ${secret}`) {
    return unauthorized();
  }

  const token = process.env.APIFY_API_TOKEN?.trim();
  if (!token) {
    return Response.json(
      { error: "APIFY_API_TOKEN is not configured" },
      { status: 500 },
    );
  }

  const youtubeActor =
    process.env.APIFY_YOUTUBE_ACTOR_ID?.trim() || DEFAULT_APIFY_YOUTUBE_ACTOR;
  const tiktokActor =
    process.env.APIFY_TIKTOK_ACTOR_ID?.trim() || DEFAULT_APIFY_TIKTOK_ACTOR;

  try {
    const env = loadCreatorWebEnv();
    const result = await syncPostedVideoViewsForAllApproved({
      env,
      apifyToken: token,
      youtubeActorId: youtubeActor,
      tiktokActorId: tiktokActor,
    });
    return Response.json({ ok: true, ...result });
  } catch (e) {
    console.error("[cron] sync-creator-post-views:", e);
    const message = e instanceof Error ? e.message : "sync failed";
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}
