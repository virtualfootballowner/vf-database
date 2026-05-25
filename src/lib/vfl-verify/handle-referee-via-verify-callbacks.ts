import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";

import { applyRefereeGuildRename } from "@/lib/vfl-verify/apply-referee-rename";
import { exchangeDiscordCode } from "@/lib/vfl-verify/discord-oauth";
import {
  loadRefereeVerifyEnv,
  refereeVerifyEnvAsVerifyEnv,
} from "@/lib/vfl-verify/load-referee-verify-env";
import { generatePkcePair } from "@/lib/vfl-verify/pkce";
import { robloxAuthorizeUrl, exchangeRobloxCode } from "@/lib/vfl-verify/roblox-oauth";
import {
  openVerifySession,
  sealVerifySession,
} from "@/lib/vfl-verify/signed-session";
import { completeRefereeVerify } from "@/lib/referees/complete-referee-verify";

const DEFAULT_REFEREE_APPROVAL_CHANNEL_ID = "1508189919732830278";

export const REFEREE_DISCORD_STATE_COOKIE = "vfl_ref_state";
export const REFEREE_ROBLOX_STATE_COOKIE = "vfl_ref_rb_state";
export const REFEREE_SESSION_COOKIE = "vfl_ref_v_sess";
const SESSION_TTL_MS = 15 * 60 * 1000;

function refereeApprovalChannelId(): string {
  return (
    process.env.DISCORD_REFEREE_APPROVAL_CHANNEL_ID?.trim() ||
    DEFAULT_REFEREE_APPROVAL_CHANNEL_ID
  );
}

function done(request: Request, params: Record<string, string>): NextResponse {
  const target = new URL("/verify/referee/done", request.url);
  for (const [k, v] of Object.entries(params)) target.searchParams.set(k, v);
  return NextResponse.redirect(target);
}

function clearRefereeCookies(res: NextResponse, secure: boolean): void {
  const z = {
    httpOnly: true,
    secure,
    sameSite: "lax" as const,
    path: "/",
    maxAge: 0,
  };
  res.cookies.set(REFEREE_DISCORD_STATE_COOKIE, "", z);
  res.cookies.set(REFEREE_ROBLOX_STATE_COOKIE, "", z);
  res.cookies.set(REFEREE_SESSION_COOKIE, "", z);
}

export async function tryCompleteRefereeDiscordViaVerifyCallback(
  request: Request,
  code: string,
  state: string,
): Promise<NextResponse | null> {
  const cookieStore = await cookies();
  const storedState =
    cookieStore.get(REFEREE_DISCORD_STATE_COOKIE)?.value ?? null;
  if (!storedState || storedState !== state) {
    return null;
  }

  const secure = process.env.NODE_ENV === "production";

  let env;
  try {
    env = loadRefereeVerifyEnv();
  } catch {
    const res = done(request, { err: "config" });
    clearRefereeCookies(res, secure);
    return res;
  }

  const exchanged = await exchangeDiscordCode(
    refereeVerifyEnvAsVerifyEnv(env),
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
    clearRefereeCookies(res, secure);
    return res;
  }

  const { verifier, challenge } = generatePkcePair();
  const sealed = sealVerifySession(
    env.VERIFY_COOKIE_SECRET,
    { discordUserId: exchanged.discordUserId, codeVerifier: verifier },
    SESSION_TTL_MS,
  );

  const rbState = randomBytes(16).toString("hex");
  const robloxUrl = robloxAuthorizeUrl(refereeVerifyEnvAsVerifyEnv(env), {
    state: rbState,
    codeChallenge: challenge,
  });

  const res = NextResponse.redirect(robloxUrl);
  res.cookies.set(REFEREE_DISCORD_STATE_COOKIE, "", {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  res.cookies.set(REFEREE_SESSION_COOKIE, sealed, {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    maxAge: Math.ceil(SESSION_TTL_MS / 1000),
  });
  res.cookies.set(REFEREE_ROBLOX_STATE_COOKIE, rbState, {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });
  return res;
}

export async function tryCompleteRefereeRobloxViaVerifyCallback(
  request: Request,
  code: string,
  state: string,
): Promise<NextResponse | null> {
  const cookieStore = await cookies();
  const storedRb = cookieStore.get(REFEREE_ROBLOX_STATE_COOKIE)?.value ?? null;
  if (!storedRb || storedRb !== state) {
    return null;
  }

  const secure = process.env.NODE_ENV === "production";

  let env;
  try {
    env = loadRefereeVerifyEnv();
  } catch {
    const res = done(request, { err: "config" });
    clearRefereeCookies(res, secure);
    return res;
  }

  const sealed = cookieStore.get(REFEREE_SESSION_COOKIE)?.value ?? null;
  if (!sealed) {
    const res = done(request, { err: "session" });
    clearRefereeCookies(res, secure);
    return res;
  }

  const session = openVerifySession(env.VERIFY_COOKIE_SECRET, sealed);
  if (!session) {
    const res = done(request, { err: "session_expired" });
    clearRefereeCookies(res, secure);
    return res;
  }

  const roblox = await exchangeRobloxCode(
    refereeVerifyEnvAsVerifyEnv(env),
    code,
    session.codeVerifier,
  );
  if (!roblox) {
    const res = done(request, { err: "roblox_token" });
    clearRefereeCookies(res, secure);
    return res;
  }

  const renamed = await applyRefereeGuildRename(
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
    clearRefereeCookies(res, secure);
    return res;
  }

  const completed = await completeRefereeVerify({
    botToken: env.DISCORD_BOT_TOKEN,
    approvalChannelId: refereeApprovalChannelId(),
    discordUserId: session.discordUserId,
    robloxUserId: roblox.userId,
    robloxUsername: roblox.username,
  });

  if (!completed.ok) {
    const errKey =
      completed.code === "suspended"
        ? "suspended"
        : completed.code === "card_failed"
          ? "card_failed"
          : completed.code === "missing_channel"
            ? "config"
            : "db_error";
    const res = done(request, { err: errKey });
    clearRefereeCookies(res, secure);
    return res;
  }

  const outcomeParam =
    completed.outcome === "already_active"
      ? "already_active"
      : completed.outcome === "already_pending"
        ? "already_pending"
        : "ok";

  const res = done(request, { [outcomeParam]: "1" });
  clearRefereeCookies(res, secure);
  return res;
}
