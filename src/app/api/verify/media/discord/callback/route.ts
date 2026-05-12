import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { exchangeDiscordCode } from "@/lib/vfl-verify/discord-oauth";
import {
  loadMediaVerifyEnv,
  mediaVerifyEnvAsVerifyEnv,
} from "@/lib/vfl-verify/load-media-verify-env";
import { generatePkcePair } from "@/lib/vfl-verify/pkce";
import { robloxAuthorizeUrl } from "@/lib/vfl-verify/roblox-oauth";
import { sealVerifySession } from "@/lib/vfl-verify/signed-session";

const MEDIA_DISCORD_STATE_COOKIE = "vfl_md_state";
const MEDIA_ROBLOX_STATE_COOKIE = "vfl_mrb_state";
const MEDIA_SESSION_COOKIE = "vfl_mv_sess";
const MEDIA_DISCORD_REDIRECT_PATH = "/api/verify/media/discord/callback";
const MEDIA_ROBLOX_REDIRECT_PATH = "/api/verify/media/roblox/callback";
const SESSION_TTL_MS = 15 * 60 * 1000;

export async function GET(request: Request) {
  let env;
  try {
    env = loadMediaVerifyEnv();
  } catch {
    return NextResponse.redirect(
      new URL("/verify/media/done?err=config", request.url),
    );
  }

  const urlObj = new URL(request.url);
  const code = urlObj.searchParams.get("code");
  const state = urlObj.searchParams.get("state");
  const err = urlObj.searchParams.get("error");

  if (err || !code || !state) {
    return NextResponse.redirect(
      new URL("/verify/media/done?err=discord_denied", request.url),
    );
  }

  const cookieStore = await cookies();
  const storedState = cookieStore.get(MEDIA_DISCORD_STATE_COOKIE)?.value ?? null;
  if (!storedState || storedState !== state) {
    return NextResponse.redirect(
      new URL("/verify/media/done?err=discord_state", request.url),
    );
  }

  const exchanged = await exchangeDiscordCode(
    mediaVerifyEnvAsVerifyEnv(env),
    code,
    MEDIA_DISCORD_REDIRECT_PATH,
  );
  if ("failure" in exchanged) {
    const { stage, status, errorCode, errorDescription } = exchanged.failure;
    const target = new URL("/verify/media/done", request.url);
    target.searchParams.set("err", "discord_token");
    target.searchParams.set("stage", stage);
    if (status != null) target.searchParams.set("st", String(status));
    if (errorCode) target.searchParams.set("ec", errorCode);
    if (errorDescription) target.searchParams.set("ed", errorDescription);
    return NextResponse.redirect(target);
  }

  const { verifier, challenge } = generatePkcePair();
  const sealed = sealVerifySession(
    env.VERIFY_COOKIE_SECRET,
    { discordUserId: exchanged.discordUserId, codeVerifier: verifier },
    SESSION_TTL_MS,
  );

  const rbState = randomBytes(16).toString("hex");
  const robloxUrl = robloxAuthorizeUrl(mediaVerifyEnvAsVerifyEnv(env), {
    state: rbState,
    codeChallenge: challenge,
    redirectPath: MEDIA_ROBLOX_REDIRECT_PATH,
  });

  const res = NextResponse.redirect(robloxUrl);
  const secure = process.env.NODE_ENV === "production";

  res.cookies.set(MEDIA_DISCORD_STATE_COOKIE, "", {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  res.cookies.set(MEDIA_SESSION_COOKIE, sealed, {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    maxAge: Math.ceil(SESSION_TTL_MS / 1000),
  });
  res.cookies.set(MEDIA_ROBLOX_STATE_COOKIE, rbState, {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });

  return res;
}
