import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { applyMediaGuildRename } from "@/lib/vfl-verify/apply-media-rename";
import { exchangeDiscordCode } from "@/lib/vfl-verify/discord-oauth";
import {
  loadMediaVerifyEnv,
  mediaVerifyEnvAsVerifyEnv,
} from "@/lib/vfl-verify/load-media-verify-env";
import { generatePkcePair } from "@/lib/vfl-verify/pkce";
import { robloxAuthorizeUrl, exchangeRobloxCode } from "@/lib/vfl-verify/roblox-oauth";
import {
  openVerifySession,
  sealVerifySession,
} from "@/lib/vfl-verify/signed-session";
import { randomBytes } from "node:crypto";

/**
 * Media verify flow piggybacks on the **same** Discord + Roblox OAuth
 * redirect URIs as the league `/verify` flow. To distinguish the two we set
 * separate cookies during `/api/verify/media/start` — the shared callbacks
 * call these helpers first and bail (return null) when the request isn't a
 * media-flow request.
 */

const MEDIA_DISCORD_STATE_COOKIE = "vfl_md_state";
const MEDIA_ROBLOX_STATE_COOKIE = "vfl_md_rb_state";
const MEDIA_SESSION_COOKIE = "vfl_md_v_sess";
const SESSION_TTL_MS = 15 * 60 * 1000;

function done(request: Request, params: Record<string, string>): NextResponse {
  const target = new URL("/verify/media/done", request.url);
  for (const [k, v] of Object.entries(params)) target.searchParams.set(k, v);
  return NextResponse.redirect(target);
}

function clearMediaCookies(res: NextResponse, secure: boolean): void {
  const z = {
    httpOnly: true,
    secure,
    sameSite: "lax" as const,
    path: "/",
    maxAge: 0,
  };
  res.cookies.set(MEDIA_DISCORD_STATE_COOKIE, "", z);
  res.cookies.set(MEDIA_ROBLOX_STATE_COOKIE, "", z);
  res.cookies.set(MEDIA_SESSION_COOKIE, "", z);
}

/**
 * Discord-callback half. Returns a response if the request matches the
 * media-flow Discord state cookie; null otherwise (callback continues).
 */
export async function tryCompleteMediaDiscordViaVerifyCallback(
  request: Request,
  code: string,
  state: string,
): Promise<NextResponse | null> {
  const cookieStore = await cookies();
  const storedState =
    cookieStore.get(MEDIA_DISCORD_STATE_COOKIE)?.value ?? null;
  if (!storedState || storedState !== state) {
    return null;
  }

  const secure = process.env.NODE_ENV === "production";

  let env;
  try {
    env = loadMediaVerifyEnv();
  } catch {
    const res = done(request, { err: "config" });
    clearMediaCookies(res, secure);
    return res;
  }

  const exchanged = await exchangeDiscordCode(
    mediaVerifyEnvAsVerifyEnv(env),
    code,
  );
  if ("failure" in exchanged) {
    const { stage, status, errorCode, errorDescription } = exchanged.failure;
    const params: Record<string, string> = {
      err: "discord_token",
      stage,
    };
    if (status != null) params.st = String(status);
    if (errorCode) params.ec = errorCode;
    if (errorDescription) params.ed = errorDescription;
    const res = done(request, params);
    clearMediaCookies(res, secure);
    return res;
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
  });

  const res = NextResponse.redirect(robloxUrl);
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

/**
 * Roblox-callback half. Returns a response if the request matches the
 * media-flow Roblox state cookie; null otherwise (callback continues).
 */
export async function tryCompleteMediaRobloxViaVerifyCallback(
  request: Request,
  code: string,
  state: string,
): Promise<NextResponse | null> {
  const cookieStore = await cookies();
  const storedRb = cookieStore.get(MEDIA_ROBLOX_STATE_COOKIE)?.value ?? null;
  if (!storedRb || storedRb !== state) {
    return null;
  }

  const secure = process.env.NODE_ENV === "production";

  let env;
  try {
    env = loadMediaVerifyEnv();
  } catch {
    const res = done(request, { err: "config" });
    clearMediaCookies(res, secure);
    return res;
  }

  const sealed = cookieStore.get(MEDIA_SESSION_COOKIE)?.value ?? null;
  if (!sealed) {
    const res = done(request, { err: "session" });
    clearMediaCookies(res, secure);
    return res;
  }

  const session = openVerifySession(env.VERIFY_COOKIE_SECRET, sealed);
  if (!session) {
    const res = done(request, { err: "session_expired" });
    clearMediaCookies(res, secure);
    return res;
  }

  const roblox = await exchangeRobloxCode(
    mediaVerifyEnvAsVerifyEnv(env),
    code,
    session.codeVerifier,
  );
  if (!roblox) {
    const res = done(request, { err: "roblox_token" });
    clearMediaCookies(res, secure);
    return res;
  }

  const renamed = await applyMediaGuildRename(
    env,
    session.discordUserId,
    roblox.username,
  );
  if (!renamed.ok) {
    const errKey =
      renamed.code === "not_in_guild"
        ? "not_in_guild"
        : renamed.code === "nick_failed"
          ? "nick_forbidden"
          : "discord_api";
    const res = done(request, { err: errKey });
    clearMediaCookies(res, secure);
    return res;
  }

  const res = done(request, { ok: "1" });
  clearMediaCookies(res, secure);
  return res;
}
