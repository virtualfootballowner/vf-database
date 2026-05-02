import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";

import { loadVerifyEnv } from "@/lib/vfl-verify/load-verify-env";
import { discordAuthorizeUrl } from "@/lib/vfl-verify/discord-oauth";

const STATE_COOKIE = "vfl_d_state";
const MAX_AGE = 600;

export async function GET() {
  let env;
  try {
    env = loadVerifyEnv();
  } catch {
    return NextResponse.json(
      { error: "Verification is not configured on this deployment." },
      { status: 503 },
    );
  }

  const state = randomBytes(24).toString("hex");
  const url = discordAuthorizeUrl(env, state);
  const res = NextResponse.redirect(url);
  const secure = process.env.NODE_ENV === "production";
  res.cookies.set(STATE_COOKIE, state, {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE,
  });
  return res;
}
