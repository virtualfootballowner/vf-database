import { NextResponse } from "next/server";
import { z } from "zod";

import { readCreatorSessionPayload } from "@/lib/creator-onboard/cookie-helpers";
import { stripAtHandle } from "@/lib/creator-onboard/validators";
import { createCreatorSupabaseAdmin } from "@/lib/creator-onboard/supabase-creator";

const bodySchema = z.object({
  // Roblox OAuth is pending — accept manual username entry for now.
  roblox_username: z
    .string()
    .trim()
    .min(3, "Roblox username must be 3–20 characters.")
    .max(20, "Roblox username must be 3–20 characters.")
    .regex(/^[A-Za-z0-9_]+$/, "Letters, numbers, and underscores only."),
  tiktok_handle: z.string().max(120).optional().nullable(),
  youtube_handle: z.string().max(120).optional().nullable(),
  age: z.number().int().min(13).max(120),
  country: z.string().length(2),
  email: z.string().email(),
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

  const tiktok = stripAtHandle(parsed.data.tiktok_handle);
  const youtube = stripAtHandle(parsed.data.youtube_handle);
  if (!tiktok && !youtube) {
    return NextResponse.json(
      { error: "Provide at least one of TikTok or YouTube handle." },
      { status: 400 },
    );
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

  const { error } = await supabase
    .from("creator_applications")
    .update({
      roblox_username: parsed.data.roblox_username,
      tiktok_handle: tiktok,
      youtube_handle: youtube,
      age: parsed.data.age,
      country: parsed.data.country.toUpperCase(),
      email: parsed.data.email.trim(),
      updated_at: now,
    })
    .eq("id", session.applicationId);

  if (error) {
    console.error("[creator] draft patch:", error);
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
