import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";

import { discordAuthorizeUrl } from "@/lib/vfl-verify/discord-oauth";
import {
  loadMediaVerifyEnv,
  mediaVerifyEnvAsVerifyEnv,
} from "@/lib/vfl-verify/load-media-verify-env";

const MEDIA_STAFF_DISCORD_STATE = "vfl_mdst_d_state";
const MAX_AGE_SECONDS = 600;

export async function GET() {
  let env;
  try {
    env = loadMediaVerifyEnv();
  } catch {
    return NextResponse.json(
      { error: "Media verification is not configured on this deployment." },
      { status: 503 },
    );
  }

  const state = randomBytes(24).toString("hex");
  const url = discordAuthorizeUrl(mediaVerifyEnvAsVerifyEnv(env), state);
  const res = NextResponse.redirect(url);
  res.cookies.set(MEDIA_STAFF_DISCORD_STATE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
  return res;
}
