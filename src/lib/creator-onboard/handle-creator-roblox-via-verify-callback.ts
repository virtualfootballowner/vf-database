import { NextResponse } from "next/server";

import {
  clearCreatorOAuthCookies,
  clearCreatorRobloxOAuthStateOnResponse,
  getRobloxOAuthStateCookie,
  readCreatorSessionPayload,
  setCreatorSessionOnResponse,
} from "@/lib/creator-onboard/cookie-helpers";
import { upsertDraftAfterRoblox } from "@/lib/creator-onboard/db-draft";
import {
  creatorPublicBaseUrl,
  loadCreatorWebEnv,
} from "@/lib/creator-onboard/env-web";
import { exchangeCreatorRobloxCode } from "@/lib/creator-onboard/roblox-oauth";

/**
 * Completes creator onboarding after Roblox redirects to the shared
 * `/api/verify/roblox/callback` URL. Returns null if this request is not
 * part of the creator flow (state does not match vf_creator_rb_st).
 */
export async function tryCompleteCreatorRobloxOAuthViaVerifyCallback(
  request: Request,
  code: string,
  state: string,
): Promise<NextResponse | null> {
  const storedFirst = await getRobloxOAuthStateCookie();
  if (!storedFirst || storedFirst !== state) {
    return null;
  }

  let env;
  try {
    env = loadCreatorWebEnv();
  } catch {
    return NextResponse.redirect(
      new URL(
        "/content/creators/onboard/error?c=config",
        new URL(request.url).origin,
      ),
    );
  }

  const base = creatorPublicBaseUrl(env);

  function fail(codeStr: string): NextResponse {
    const res = NextResponse.redirect(
      new URL(
        `/content/creators/onboard/error?c=${encodeURIComponent(codeStr)}`,
        base,
      ),
    );
    clearCreatorOAuthCookies(res);
    return res;
  }

  const { session } = await readCreatorSessionPayload();
  if (!session?.codeVerifier || !session.expectedDiscordId) {
    return fail("session");
  }

  const roblox = await exchangeCreatorRobloxCode(
    env,
    code,
    session.codeVerifier,
  );
  if (!roblox) {
    return fail("token");
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
    return fail(codeMap[draft.reason] ?? "db");
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
  clearCreatorRobloxOAuthStateOnResponse(res);
  return res;
}
