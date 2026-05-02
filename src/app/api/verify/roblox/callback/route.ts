import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { loadVerifyEnv } from "@/lib/vfl-verify/load-verify-env";
import { applyGuildVerification } from "@/lib/vfl-verify/apply-guild-verification";
import { exchangeRobloxCode } from "@/lib/vfl-verify/roblox-oauth";
import { openVerifySession } from "@/lib/vfl-verify/signed-session";

const ROBLOX_STATE = "vfl_rb_state";
const VERIFY_SESS = "vfl_v_sess";

function clearVerifyCookies(
  res: NextResponse,
  secure: boolean,
) {
  const z = { httpOnly: true, secure, sameSite: "lax" as const, path: "/", maxAge: 0 };
  res.cookies.set(VERIFY_SESS, "", z);
  res.cookies.set(ROBLOX_STATE, "", z);
}

export async function GET(request: Request) {
  let env;
  try {
    env = loadVerifyEnv();
  } catch {
    return NextResponse.redirect(
      new URL("/verify/done?err=config", request.url),
    );
  }

  const secure = process.env.NODE_ENV === "production";
  const urlObj = new URL(request.url);
  const code = urlObj.searchParams.get("code");
  const state = urlObj.searchParams.get("state");
  const err = urlObj.searchParams.get("error");

  if (err || !code || !state) {
    const res = NextResponse.redirect(
      new URL("/verify/done?err=roblox_denied", request.url),
    );
    clearVerifyCookies(res, secure);
    return res;
  }

  const cookieStore = await cookies();
  const storedRb = cookieStore.get(ROBLOX_STATE)?.value ?? null;
  if (!storedRb || storedRb !== state) {
    const res = NextResponse.redirect(
      new URL("/verify/done?err=roblox_state", request.url),
    );
    clearVerifyCookies(res, secure);
    return res;
  }

  const sealed = cookieStore.get(VERIFY_SESS)?.value ?? null;
  if (!sealed) {
    const res = NextResponse.redirect(
      new URL("/verify/done?err=session", request.url),
    );
    clearVerifyCookies(res, secure);
    return res;
  }

  const session = openVerifySession(env.VERIFY_COOKIE_SECRET, sealed);
  if (!session) {
    const res = NextResponse.redirect(
      new URL("/verify/done?err=session_expired", request.url),
    );
    clearVerifyCookies(res, secure);
    return res;
  }

  const roblox = await exchangeRobloxCode(env, code, session.codeVerifier);
  if (!roblox) {
    const res = NextResponse.redirect(
      new URL("/verify/done?err=roblox_token", request.url),
    );
    clearVerifyCookies(res, secure);
    return res;
  }

  const applied = await applyGuildVerification(
    env,
    session.discordUserId,
    roblox.username,
  );

  if (!applied.ok) {
    const q =
      applied.code === "not_in_guild"
        ? "not_in_guild"
        : applied.code === "nick_failed"
          ? "nick_forbidden"
          : "discord_api";
    const res = NextResponse.redirect(new URL(`/verify/done?err=${q}`, request.url));
    clearVerifyCookies(res, secure);
    return res;
  }

  const res = NextResponse.redirect(new URL("/verify/done?ok=1", request.url));
  clearVerifyCookies(res, secure);
  return res;
}
