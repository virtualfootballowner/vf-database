import { NextResponse } from "next/server";

import { readCreatorSessionPayload } from "@/lib/creator-onboard/cookie-helpers";
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
    .select(
      "id, discord_id, status, tiktok_handle, youtube_handle, age, country, email, rules_accepted_at",
    )
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

  const hasSocial =
    (row.tiktok_handle && String(row.tiktok_handle).trim()) ||
    (row.youtube_handle && String(row.youtube_handle).trim());
  if (
    !hasSocial ||
    row.age == null ||
    !row.country ||
    !row.email ||
    !row.rules_accepted_at
  ) {
    return NextResponse.json(
      { error: "Complete rules and details first." },
      { status: 400 },
    );
  }

  const { error } = await supabase
    .from("creator_applications")
    .update({
      expectations_accepted_at: now,
      updated_at: now,
    })
    .eq("id", session.applicationId);

  if (error) {
    console.error("[creator] expectations:", error);
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
