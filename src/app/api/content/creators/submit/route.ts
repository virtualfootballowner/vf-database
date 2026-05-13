import { NextResponse } from "next/server";

import { readCreatorSessionPayload } from "@/lib/creator-onboard/cookie-helpers";
import { postCreatorApprovalCardViaDiscordApi } from "@/lib/creator-onboard/post-creator-approval-card";
import { isCreatorPlayPlatform } from "@/lib/creator-onboard/play-platform";
import { createCreatorSupabaseAdmin } from "@/lib/creator-onboard/supabase-creator";

export async function POST() {
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

  const supabase = createCreatorSupabaseAdmin(env);
  const now = new Date().toISOString();

  const { data: row, error: fetchErr } = await supabase
    .from("creator_applications")
    .select("*")
    .eq("id", session.applicationId)
    .maybeSingle();

  if (fetchErr || !row || row.discord_id !== session.expectedDiscordId) {
    return NextResponse.json({ error: "Application not found." }, { status: 404 });
  }

  if (row.status !== "draft") {
    return NextResponse.json(
      { error: "Already submitted or resolved." },
      { status: 409 },
    );
  }

  const hasTiktok =
    !!row.tiktok_handle && String(row.tiktok_handle).trim().length > 0;

  const playPlatformRaw =
    typeof row.play_platform === "string" ? row.play_platform.trim().toLowerCase() : "";
  const playPlatformOk = isCreatorPlayPlatform(playPlatformRaw);

  if (
    !hasTiktok ||
    row.age == null ||
    !row.country ||
    !playPlatformOk ||
    !row.rules_accepted_at ||
    !row.expectations_accepted_at ||
    !row.roblox_id ||
    !row.roblox_username ||
    !row.discord_username
  ) {
    return NextResponse.json(
      { error: "Application is incomplete." },
      { status: 400 },
    );
  }

  const { error } = await supabase
    .from("creator_applications")
    .update({
      status: "pending",
      updated_at: now,
    })
    .eq("id", session.applicationId);

  if (error) {
    console.error("[creator] submit:", error);
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }

  const token = env.DISCORD_BOT_TOKEN;
  const ch = env.DISCORD_CREATOR_APPROVAL_CHANNEL_ID;
  if (token && ch) {
    const posted = await postCreatorApprovalCardViaDiscordApi({
      botToken: token,
      channelId: ch,
      applicationId: session.applicationId,
      row: row as Record<string, unknown>,
    });
    if (!posted.ok) {
      console.error("[creator] Discord post failed:", posted.detail);
    }
  } else {
    console.warn(
      "[creator] Set DISCORD_BOT_TOKEN + DISCORD_CREATOR_APPROVAL_CHANNEL_ID (same as bot) to post staff review cards.",
    );
  }

  return NextResponse.json({ ok: true });
}
