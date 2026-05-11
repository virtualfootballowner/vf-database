import { NextResponse } from "next/server";

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

  const sealed = sealCreatorSession(
    env.CREATOR_SESSION_SECRET,
    { expectedDiscordId: discordId },
    CREATOR_SESSION_TTL_MS,
  );

  const secure = process.env.NODE_ENV === "production";
  const res = NextResponse.redirect(
    new URL(
      "/content/creators/onboard/roblox",
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
