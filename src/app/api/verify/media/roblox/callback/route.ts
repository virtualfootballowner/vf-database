import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { applyMediaGuildRename } from "@/lib/vfl-verify/apply-media-rename";
import {
  loadMediaVerifyEnv,
  mediaVerifyEnvAsVerifyEnv,
} from "@/lib/vfl-verify/load-media-verify-env";
import { exchangeRobloxCode } from "@/lib/vfl-verify/roblox-oauth";
import { openVerifySession } from "@/lib/vfl-verify/signed-session";

const MEDIA_ROBLOX_STATE_COOKIE = "vfl_mrb_state";
const MEDIA_SESSION_COOKIE = "vfl_mv_sess";
const MEDIA_ROBLOX_REDIRECT_PATH = "/api/verify/media/roblox/callback";

function clearMediaVerifyCookies(res: NextResponse, secure: boolean) {
  const z = {
    httpOnly: true,
    secure,
    sameSite: "lax" as const,
    path: "/",
    maxAge: 0,
  };
  res.cookies.set(MEDIA_SESSION_COOKIE, "", z);
  res.cookies.set(MEDIA_ROBLOX_STATE_COOKIE, "", z);
}

export async function GET(request: Request) {
  let env;
  try {
    env = loadMediaVerifyEnv();
  } catch {
    return NextResponse.redirect(
      new URL("/verify/media/done?err=config", request.url),
    );
  }

  const secure = process.env.NODE_ENV === "production";
  const urlObj = new URL(request.url);
  const code = urlObj.searchParams.get("code");
  const state = urlObj.searchParams.get("state");
  const err = urlObj.searchParams.get("error");

  if (err || !code || !state) {
    const res = NextResponse.redirect(
      new URL("/verify/media/done?err=roblox_denied", request.url),
    );
    clearMediaVerifyCookies(res, secure);
    return res;
  }

  const cookieStore = await cookies();
  const storedRb = cookieStore.get(MEDIA_ROBLOX_STATE_COOKIE)?.value ?? null;
  if (!storedRb || storedRb !== state) {
    const res = NextResponse.redirect(
      new URL("/verify/media/done?err=roblox_state", request.url),
    );
    clearMediaVerifyCookies(res, secure);
    return res;
  }

  const sealed = cookieStore.get(MEDIA_SESSION_COOKIE)?.value ?? null;
  if (!sealed) {
    const res = NextResponse.redirect(
      new URL("/verify/media/done?err=session", request.url),
    );
    clearMediaVerifyCookies(res, secure);
    return res;
  }

  const session = openVerifySession(env.VERIFY_COOKIE_SECRET, sealed);
  if (!session) {
    const res = NextResponse.redirect(
      new URL("/verify/media/done?err=session_expired", request.url),
    );
    clearMediaVerifyCookies(res, secure);
    return res;
  }

  const roblox = await exchangeRobloxCode(
    mediaVerifyEnvAsVerifyEnv(env),
    code,
    session.codeVerifier,
    MEDIA_ROBLOX_REDIRECT_PATH,
  );
  if (!roblox) {
    const res = NextResponse.redirect(
      new URL("/verify/media/done?err=roblox_token", request.url),
    );
    clearMediaVerifyCookies(res, secure);
    return res;
  }

  const renamed = await applyMediaGuildRename(
    env,
    session.discordUserId,
    roblox.username,
  );
  if (!renamed.ok) {
    const q =
      renamed.code === "not_in_guild"
        ? "not_in_guild"
        : renamed.code === "nick_failed"
          ? "nick_forbidden"
          : "discord_api";
    const res = NextResponse.redirect(
      new URL(`/verify/media/done?err=${q}`, request.url),
    );
    clearMediaVerifyCookies(res, secure);
    return res;
  }

  const res = NextResponse.redirect(
    new URL("/verify/media/done?ok=1", request.url),
  );
  clearMediaVerifyCookies(res, secure);
  return res;
}
