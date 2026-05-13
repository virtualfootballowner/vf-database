import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import {
  MEDIA_STAFF_APP_COOKIE,
  openMediaStaffApp,
} from "@/lib/media-staff/media-staff-session";
import { loadMediaVerifyEnv } from "@/lib/vfl-verify/load-media-verify-env";

export const dynamic = "force-dynamic";

export async function GET() {
  let env;
  try {
    env = loadMediaVerifyEnv();
  } catch {
    return NextResponse.json(
      { ok: false, error: "not_configured" },
      { status: 503 },
    );
  }

  const sealed = (await cookies()).get(MEDIA_STAFF_APP_COOKIE)?.value ?? null;
  if (!sealed) {
    return NextResponse.json({ ok: false, error: "no_session" }, { status: 401 });
  }

  const session = openMediaStaffApp(env.VERIFY_COOKIE_SECRET, sealed);
  if (!session) {
    return NextResponse.json(
      { ok: false, error: "invalid_session" },
      { status: 401 },
    );
  }

  return NextResponse.json({
    ok: true,
    discordUserId: session.discordUserId,
    robloxUserId: session.robloxUserId,
    robloxUsername: session.robloxUsername,
    robloxAvatarUrl: session.robloxAvatarUrl ?? null,
  });
}
