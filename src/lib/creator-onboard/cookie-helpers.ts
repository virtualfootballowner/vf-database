import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { loadCreatorWebEnv } from "@/lib/creator-onboard/env-web";
import {
  CREATOR_SESSION_COOKIE,
  CREATOR_SESSION_TTL_MS,
  openCreatorSession,
  sealCreatorSession,
} from "@/lib/creator-onboard/session";

const ROBLOX_OAUTH_STATE = "vf_creator_rb_st";
const DISCORD_OAUTH_STATE = "vf_creator_dc_st";

function cookieOpts(maxAgeSec: number): {
  httpOnly: boolean;
  secure: boolean;
  sameSite: "lax";
  path: string;
  maxAge: number;
} {
  const secure = process.env.NODE_ENV === "production";
  return {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    maxAge: maxAgeSec,
  };
}

export function clearCreatorOAuthCookies(res: NextResponse) {
  const z = cookieOpts(0);
  res.cookies.set(ROBLOX_OAUTH_STATE, "", z);
  res.cookies.set(DISCORD_OAUTH_STATE, "", z);
}

export async function readCreatorSessionPayload() {
  const env = loadCreatorWebEnv();
  const jar = await cookies();
  const raw = jar.get(CREATOR_SESSION_COOKIE)?.value ?? null;
  if (!raw) return { env, session: null as ReturnType<typeof openCreatorSession> };
  return { env, session: openCreatorSession(env.CREATOR_SESSION_SECRET, raw) };
}

export async function setCreatorSessionOnResponse(
  res: NextResponse,
  payload: Omit<import("@/lib/creator-onboard/session").CreatorSessionPayload, "exp">,
) {
  const env = loadCreatorWebEnv();
  const sealed = sealCreatorSession(
    env.CREATOR_SESSION_SECRET,
    payload,
    CREATOR_SESSION_TTL_MS,
  );
  res.cookies.set(
    CREATOR_SESSION_COOKIE,
    sealed,
    cookieOpts(Math.ceil(CREATOR_SESSION_TTL_MS / 1000)),
  );
}

export async function getRobloxOAuthStateCookie(): Promise<string | null> {
  const jar = await cookies();
  return jar.get(ROBLOX_OAUTH_STATE)?.value ?? null;
}

export async function getDiscordOAuthStateCookie(): Promise<string | null> {
  const jar = await cookies();
  return jar.get(DISCORD_OAUTH_STATE)?.value ?? null;
}

export function setRobloxOAuthStateOnResponse(res: NextResponse, state: string) {
  res.cookies.set(ROBLOX_OAUTH_STATE, state, cookieOpts(600));
}

export function setDiscordOAuthStateOnResponse(res: NextResponse, state: string) {
  res.cookies.set(DISCORD_OAUTH_STATE, state, cookieOpts(600));
}

export { ROBLOX_OAUTH_STATE, DISCORD_OAUTH_STATE };
