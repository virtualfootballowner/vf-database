import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { loadVerifyEnv } from "@/lib/vfl-verify/load-verify-env";
import { exchangeDiscordCode } from "@/lib/vfl-verify/discord-oauth";
import { tryCompleteMediaDiscordViaVerifyCallback } from "@/lib/vfl-verify/handle-media-via-verify-callbacks";
import { generatePkcePair } from "@/lib/vfl-verify/pkce";
import { robloxAuthorizeUrl } from "@/lib/vfl-verify/roblox-oauth";
import { sealVerifySession } from "@/lib/vfl-verify/signed-session";

const DISCORD_STATE = "vfl_d_state";
const ROBLOX_STATE = "vfl_rb_state";
const VERIFY_SESS = "vfl_v_sess";
const SESSION_TTL_MS = 15 * 60 * 1000;

export async function GET(request: Request) {
  let env;
  try {
    env = loadVerifyEnv();
  } catch {
    return NextResponse.redirect(
      new URL("/verify/done?err=config", request.url),
    );
  }

  const urlObj = new URL(request.url);
  const code = urlObj.searchParams.get("code");
  const state = urlObj.searchParams.get("state");
  const err = urlObj.searchParams.get("error");

  if (err || !code || !state) {
    return NextResponse.redirect(new URL("/verify/done?err=discord_denied", request.url));
  }

  /**
   * Media verify flow piggybacks on this same redirect URI — dispatch first
   * so it doesn't get classified as a league-flow state mismatch.
   */
  const mediaResp = await tryCompleteMediaDiscordViaVerifyCallback(
    request,
    code,
    state,
  );
  if (mediaResp) return mediaResp;

  const cookieStore = await cookies();
  const storedState = cookieStore.get(DISCORD_STATE)?.value ?? null;
  if (!storedState || storedState !== state) {
    return NextResponse.redirect(new URL("/verify/done?err=discord_state", request.url));
  }

  const exchanged = await exchangeDiscordCode(env, code);
  if ("failure" in exchanged) {
    const { stage, status, errorCode, errorDescription } = exchanged.failure;
    const target = new URL("/verify/done", request.url);
    target.searchParams.set("err", "discord_token");
    target.searchParams.set("stage", stage);
    if (status != null) target.searchParams.set("st", String(status));
    if (errorCode) target.searchParams.set("ec", errorCode);
    if (errorDescription) target.searchParams.set("ed", errorDescription);
    return NextResponse.redirect(target);
  }

  const { verifier, challenge } = generatePkcePair();
  const sealed = sealVerifySession(env.VERIFY_COOKIE_SECRET, {
    discordUserId: exchanged.discordUserId,
    codeVerifier: verifier,
  }, SESSION_TTL_MS);

  const rbState = randomBytes(16).toString("hex");
  const robloxUrl = robloxAuthorizeUrl(env, { state: rbState, codeChallenge: challenge });

  const res = NextResponse.redirect(robloxUrl);
  const secure = process.env.NODE_ENV === "production";

  res.cookies.set(DISCORD_STATE, "", {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  res.cookies.set(VERIFY_SESS, sealed, {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    maxAge: Math.ceil(SESSION_TTL_MS / 1000),
  });
  res.cookies.set(ROBLOX_STATE, rbState, {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });

  return res;
}
