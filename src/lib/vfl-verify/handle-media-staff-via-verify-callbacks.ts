import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { applyMediaGuildRename } from "@/lib/vfl-verify/apply-media-rename";
import { exchangeDiscordCode } from "@/lib/vfl-verify/discord-oauth";
import {
  loadMediaVerifyEnv,
  mediaVerifyEnvAsVerifyEnv,
} from "@/lib/vfl-verify/load-media-verify-env";
import {
  MEDIA_STAFF_APP_COOKIE,
  sealMediaStaffApp,
} from "@/lib/media-staff/media-staff-session";
import { generatePkcePair } from "@/lib/vfl-verify/pkce";
import {
  robloxAuthorizeUrl,
  exchangeRobloxCode,
} from "@/lib/vfl-verify/roblox-oauth";
import {
  openVerifySession,
  sealVerifySession,
} from "@/lib/vfl-verify/signed-session";
import { randomBytes } from "node:crypto";

/**
 * VF Media **staff** onboarding — same OAuth URIs as `/verify`, separate cookies.
 * After Roblox: rename + verified role (same as `/verify/media`), then redirect
 * to `/content/media/onboard` with a short-lived signed cookie (no database).
 */

const MEDIA_STAFF_DISCORD_STATE = "vfl_mdst_d_state";
const MEDIA_STAFF_ROBLOX_STATE = "vfl_mdst_rb_state";
const MEDIA_STAFF_PKCE_COOKIE = "vfl_mdst_v_sess";

const OAUTH_TTL_MS = 15 * 60 * 1000;
const APP_SESSION_TTL_MS = 60 * 60 * 1000;

function done(request: Request, path: string, params: Record<string, string>) {
  const target = new URL(path, request.url);
  for (const [k, v] of Object.entries(params)) target.searchParams.set(k, v);
  return NextResponse.redirect(target);
}

export function clearMediaStaffVerifyCookies(
  res: NextResponse,
  secure: boolean,
): void {
  const z = {
    httpOnly: true,
    secure,
    sameSite: "lax" as const,
    path: "/",
    maxAge: 0,
  };
  res.cookies.set(MEDIA_STAFF_DISCORD_STATE, "", z);
  res.cookies.set(MEDIA_STAFF_ROBLOX_STATE, "", z);
  res.cookies.set(MEDIA_STAFF_PKCE_COOKIE, "", z);
}

export async function tryCompleteMediaStaffDiscordViaVerifyCallback(
  request: Request,
  code: string,
  state: string,
): Promise<NextResponse | null> {
  const cookieStore = await cookies();
  const stored =
    cookieStore.get(MEDIA_STAFF_DISCORD_STATE)?.value ?? null;
  if (!stored || stored !== state) {
    return null;
  }

  const secure = process.env.NODE_ENV === "production";

  let env;
  try {
    env = loadMediaVerifyEnv();
  } catch {
    const res = done(request, "/verify/media-staff/done", { err: "config" });
    clearMediaStaffVerifyCookies(res, secure);
    return res;
  }

  const exchanged = await exchangeDiscordCode(
    mediaVerifyEnvAsVerifyEnv(env),
    code,
  );
  if ("failure" in exchanged) {
    const { stage, status, errorCode, errorDescription } = exchanged.failure;
    const params: Record<string, string> = { err: "discord_token", stage };
    if (status != null) params.st = String(status);
    if (errorCode) params.ec = errorCode;
    if (errorDescription) params.ed = errorDescription;
    const res = done(request, "/verify/media-staff/done", params);
    clearMediaStaffVerifyCookies(res, secure);
    return res;
  }

  const { verifier, challenge } = generatePkcePair();
  const sealed = sealVerifySession(
    env.VERIFY_COOKIE_SECRET,
    { discordUserId: exchanged.discordUserId, codeVerifier: verifier },
    OAUTH_TTL_MS,
  );

  const rbState = randomBytes(16).toString("hex");
  const robloxUrl = robloxAuthorizeUrl(mediaVerifyEnvAsVerifyEnv(env), {
    state: rbState,
    codeChallenge: challenge,
  });

  const res = NextResponse.redirect(robloxUrl);
  res.cookies.set(MEDIA_STAFF_DISCORD_STATE, "", {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  res.cookies.set(MEDIA_STAFF_PKCE_COOKIE, sealed, {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    maxAge: Math.ceil(OAUTH_TTL_MS / 1000),
  });
  res.cookies.set(MEDIA_STAFF_ROBLOX_STATE, rbState, {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });
  return res;
}

export async function tryCompleteMediaStaffRobloxViaVerifyCallback(
  request: Request,
  code: string,
  state: string,
): Promise<NextResponse | null> {
  const cookieStore = await cookies();
  const storedRb =
    cookieStore.get(MEDIA_STAFF_ROBLOX_STATE)?.value ?? null;
  if (!storedRb || storedRb !== state) {
    return null;
  }

  const secure = process.env.NODE_ENV === "production";

  let env;
  try {
    env = loadMediaVerifyEnv();
  } catch {
    const res = done(request, "/verify/media-staff/done", { err: "config" });
    clearMediaStaffVerifyCookies(res, secure);
    return res;
  }

  const sealed =
    cookieStore.get(MEDIA_STAFF_PKCE_COOKIE)?.value ?? null;
  if (!sealed) {
    const res = done(request, "/verify/media-staff/done", { err: "session" });
    clearMediaStaffVerifyCookies(res, secure);
    return res;
  }

  const session = openVerifySession(env.VERIFY_COOKIE_SECRET, sealed);
  if (!session) {
    const res = done(request, "/verify/media-staff/done", {
      err: "session_expired",
    });
    clearMediaStaffVerifyCookies(res, secure);
    return res;
  }

  const roblox = await exchangeRobloxCode(
    mediaVerifyEnvAsVerifyEnv(env),
    code,
    session.codeVerifier,
  );
  if (!roblox) {
    const res = done(request, "/verify/media-staff/done", {
      err: "roblox_token",
    });
    clearMediaStaffVerifyCookies(res, secure);
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
    const res = done(request, "/verify/media-staff/done", { err: errKey });
    clearMediaStaffVerifyCookies(res, secure);
    return res;
  }

  const robloxAvatarUrl = `https://avatar.roblox.com/v1/users/avatar-headshot?userIds=${encodeURIComponent(roblox.userId)}&size=150x150&format=Png&isCircular=false`;

  const appSealed = sealMediaStaffApp(
    env.VERIFY_COOKIE_SECRET,
    {
      discordUserId: session.discordUserId,
      robloxUserId: roblox.userId,
      robloxUsername: roblox.username,
      robloxAvatarUrl,
    },
    APP_SESSION_TTL_MS,
  );

  const res = NextResponse.redirect(
    new URL("/content/media/onboard", request.url),
  );
  clearMediaStaffVerifyCookies(res, secure);
  res.cookies.set(MEDIA_STAFF_APP_COOKIE, appSealed, {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    maxAge: Math.ceil(APP_SESSION_TTL_MS / 1000),
  });
  return res;
}
