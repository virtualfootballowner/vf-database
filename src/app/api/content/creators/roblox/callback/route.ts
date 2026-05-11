import { NextResponse } from "next/server";

import {
  clearCreatorOAuthCookies,
  getRobloxOAuthStateCookie,
  readCreatorSessionPayload,
  setCreatorSessionOnResponse,
} from "@/lib/creator-onboard/cookie-helpers";
import { creatorPublicBaseUrl } from "@/lib/creator-onboard/env-web";
import { upsertDraftAfterRoblox } from "@/lib/creator-onboard/db-draft";
import { exchangeCreatorRobloxCode } from "@/lib/creator-onboard/roblox-oauth";

function failRedirect(base: string, code: string): NextResponse {
  const res = NextResponse.redirect(
    new URL(
      `/content/creators/onboard/error?c=${encodeURIComponent(code)}`,
      base,
    ),
  );
  clearCreatorOAuthCookies(res);
  return res;
}

export async function GET(request: Request) {
  let env;
  try {
    env = (await readCreatorSessionPayload()).env;
  } catch {
    return NextResponse.json({}, { status: 503 });
  }

  const base = creatorPublicBaseUrl(env);
  const secure = process.env.NODE_ENV === "production";
  const urlObj = new URL(request.url);
  const code = urlObj.searchParams.get("code");
  const state = urlObj.searchParams.get("state");
  const err = urlObj.searchParams.get("error");

  if (err || !code || !state) {
    return failRedirect(base, "denied");
  }

  const storedRb = await getRobloxOAuthStateCookie();
  if (!storedRb || storedRb !== state) {
    return failRedirect(base, "state");
  }

  const { session } = await readCreatorSessionPayload();
  if (!session?.codeVerifier) {
    return failRedirect(base, "session");
  }

  const roblox = await exchangeCreatorRobloxCode(
    env,
    code,
    session.codeVerifier,
  );
  if (!roblox) {
    return failRedirect(base, "token");
  }

  const draft = await upsertDraftAfterRoblox(env, {
    discordId: session.expectedDiscordId,
    robloxId: roblox.userId,
    robloxUsername: roblox.username,
    robloxAvatarUrl: roblox.avatarUrl,
  });

  if (!draft.ok) {
    const codeMap: Record<string, string> = {
      pending_exists: "pending",
      roblox_conflict: "roblox_taken",
      db_error: "db",
    };
    return failRedirect(base, codeMap[draft.reason] ?? "db");
  }

  const res = NextResponse.redirect(
    new URL("/content/creators/onboard/discord", base),
  );
  await setCreatorSessionOnResponse(res, {
    expectedDiscordId: session.expectedDiscordId,
    applicationId: draft.applicationId,
    robloxUserId: roblox.userId,
    robloxUsername: roblox.username,
    robloxAvatarUrl: roblox.avatarUrl,
    discordUsername: session.discordUsername,
    discordAvatarUrl: session.discordAvatarUrl,
    email: session.email,
  });
  res.cookies.set("vf_creator_rb_st", "", {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return res;
}
