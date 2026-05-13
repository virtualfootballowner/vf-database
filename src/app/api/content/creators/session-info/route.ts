import { NextResponse } from "next/server";

import { readCreatorSessionPayload } from "@/lib/creator-onboard/cookie-helpers";
import { createCreatorSupabaseAdmin } from "@/lib/creator-onboard/supabase-creator";

/** Non-sensitive progress for onboarding UI (cookie-bound session). */
export async function GET() {
  let env;
  let session;
  try {
    const r = await readCreatorSessionPayload();
    env = r.env;
    session = r.session;
  } catch {
    return NextResponse.json({ configured: false }, { status: 503 });
  }

  if (!session?.expectedDiscordId) {
    return NextResponse.json({ session: null });
  }

  let dbRow: {
    roblox_username: string;
    discord_username: string | null;
    tiktok_handle: string | null;
    youtube_handle: string | null;
    age: number | null;
    country: string | null;
    play_platform: string | null;
    email: string | null;
    rules_accepted_at: string | null;
    expectations_accepted_at: string | null;
    status: string;
  } | null = null;

  if (session.applicationId) {
    const supabase = createCreatorSupabaseAdmin(env);
    const { data } = await supabase
      .from("creator_applications")
      .select(
        "roblox_username, tiktok_handle, youtube_handle, age, country, play_platform, email, rules_accepted_at, expectations_accepted_at, status, discord_username",
      )
      .eq("id", session.applicationId)
      .maybeSingle();
    dbRow = data as typeof dbRow;
  }

  return NextResponse.json({
    configured: true,
    session: {
      expectedDiscordId: session.expectedDiscordId,
      applicationId: session.applicationId ?? null,
      robloxUsername: session.robloxUsername ?? null,
      robloxAvatarUrl: session.robloxAvatarUrl ?? null,
      discordUsername: session.discordUsername ?? null,
      discordAvatarUrl: session.discordAvatarUrl ?? null,
      email: session.email ?? null,
      db: dbRow,
    },
  });
}
