import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";

import { discordAuthorizeUrl } from "@/lib/vfl-verify/discord-oauth";
import {
  REFEREE_DISCORD_STATE_COOKIE,
} from "@/lib/vfl-verify/handle-referee-via-verify-callbacks";
import {
  loadRefereeVerifyEnv,
  refereeVerifyEnvAsVerifyEnv,
} from "@/lib/vfl-verify/load-referee-verify-env";

const MAX_AGE_SECONDS = 600;

export async function GET() {
  let env;
  try {
    env = loadRefereeVerifyEnv();
  } catch {
    return NextResponse.json(
      { error: "Referee verification is not configured on this deployment." },
      { status: 503 },
    );
  }

  const state = randomBytes(24).toString("hex");
  const url = discordAuthorizeUrl(refereeVerifyEnvAsVerifyEnv(env), state);
  const res = NextResponse.redirect(url);
  res.cookies.set(REFEREE_DISCORD_STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
  return res;
}
