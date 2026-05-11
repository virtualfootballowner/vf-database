import { NextResponse } from "next/server";

import { createDraftDiscordOnly } from "@/lib/creator-onboard/db-draft";
import {
  creatorPublicBaseUrl,
  loadCreatorWebEnv,
} from "@/lib/creator-onboard/env-web";
import {
  CREATOR_SESSION_COOKIE,
  CREATOR_SESSION_TTL_MS,
  sealCreatorSession,
} from "@/lib/creator-onboard/session";
import { isDiscordUserId } from "@/lib/creator-onboard/validators";

export async function GET(request: Request) {
  let env;
  try {
    env = loadCreatorWebEnv();
  } catch {
    return NextResponse.json(
      { error: "Creator onboarding is not configured." },
      { status: 503 },
    );
  }

  const url = new URL(request.url);
  const discordId = url.searchParams.get("discord_id")?.trim() ?? "";
  if (!isDiscordUserId(discordId)) {
    return NextResponse.json(
      { error: "Invalid or missing discord_id." },
      { status: 400 },
    );
  }

  // Roblox OAuth is pending approval — bootstrap the draft straight away
  // so the rest of the flow can run end-to-end. The Roblox username is
  // captured manually on the details page in the meantime.
  const created = await createDraftDiscordOnly(env, { discordId });
  if (!created.ok) {
    const code = created.reason === "pending_exists" ? "pending" : "db";
    return NextResponse.redirect(
      new URL(
        `/content/creators/onboard/error?c=${encodeURIComponent(code)}`,
        creatorPublicBaseUrl(env),
      ),
    );
  }

  const sealed = sealCreatorSession(
    env.CREATOR_SESSION_SECRET,
    {
      expectedDiscordId: discordId,
      applicationId: created.applicationId,
    },
    CREATOR_SESSION_TTL_MS,
  );

  const secure = process.env.NODE_ENV === "production";
  const res = NextResponse.redirect(
    new URL(
      "/content/creators/onboard/discord",
      creatorPublicBaseUrl(env),
    ),
  );
  res.cookies.set(CREATOR_SESSION_COOKIE, sealed, {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    maxAge: Math.ceil(CREATOR_SESSION_TTL_MS / 1000),
  });
  return res;
}
