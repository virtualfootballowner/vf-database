import { NextResponse } from "next/server";
import { z } from "zod";

import { readCreatorSessionPayload } from "@/lib/creator-onboard/cookie-helpers";
import { creatorPlayPlatformSchema } from "@/lib/creator-onboard/play-platform";
import {
  normalizeTiktokProfileUrl,
  normalizeYoutubeProfileUrl,
} from "@/lib/creator-onboard/validators";
import { createCreatorSupabaseAdmin } from "@/lib/creator-onboard/supabase-creator";

const bodySchema = z.object({
  tiktok_handle: z
    .string()
    .trim()
    .min(1, "TikTok profile link is required.")
    .max(2048),
  youtube_handle: z.string().max(2048).optional().nullable(),
  age: z.number().int().min(13).max(120),
  country: z.string().length(2),
  play_platform: creatorPlayPlatformSchema,
  email: z.string().email().optional().nullable().or(z.literal("")),
});

export async function PATCH(request: Request) {
  let env;
  let session;
  try {
    const r = await readCreatorSessionPayload();
    env = r.env;
    session = r.session;
  } catch {
    return NextResponse.json({ error: "Not configured" }, { status: 503 });
  }

  if (!session?.applicationId || !session.expectedDiscordId) {
    return NextResponse.json({ error: "Session expired." }, { status: 401 });
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const tiktok = normalizeTiktokProfileUrl(parsed.data.tiktok_handle);
  if (!tiktok) {
    return NextResponse.json(
      {
        error:
          "Paste a valid TikTok profile link (e.g. https://www.tiktok.com/@yourhandle).",
      },
      { status: 400 },
    );
  }
  const ytRaw =
    typeof parsed.data.youtube_handle === "string"
      ? parsed.data.youtube_handle.trim()
      : "";
  let youtube: string | null = null;
  if (ytRaw.length > 0) {
    youtube = normalizeYoutubeProfileUrl(ytRaw);
    if (!youtube) {
      return NextResponse.json(
        {
          error:
            "Paste a valid YouTube channel link (e.g. https://www.youtube.com/@yourchannel) or leave it blank.",
        },
        { status: 400 },
      );
    }
  }

  const supabase = createCreatorSupabaseAdmin(env);
  const now = new Date().toISOString();

  const { data: row, error: fetchErr } = await supabase
    .from("creator_applications")
    .select("id, discord_id, status")
    .eq("id", session.applicationId)
    .maybeSingle();

  if (fetchErr || !row || row.discord_id !== session.expectedDiscordId) {
    return NextResponse.json({ error: "Application not found." }, { status: 404 });
  }

  if (row.status !== "draft") {
    return NextResponse.json(
      { error: "Application is not editable." },
      { status: 409 },
    );
  }

  const emailRaw =
    typeof parsed.data.email === "string" ? parsed.data.email.trim() : "";
  const email = emailRaw.length > 0 ? emailRaw : null;

  const { error } = await supabase
    .from("creator_applications")
    .update({
      tiktok_handle: tiktok,
      youtube_handle: youtube,
      age: parsed.data.age,
      country: parsed.data.country.toUpperCase(),
      play_platform: parsed.data.play_platform,
      email,
      updated_at: now,
    })
    .eq("id", session.applicationId);

  if (error) {
    console.error("[creator] draft patch:", error);
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
