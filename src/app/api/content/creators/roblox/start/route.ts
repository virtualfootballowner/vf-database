import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";

import {
  readCreatorSessionPayload,
  setCreatorSessionOnResponse,
  setRobloxOAuthStateOnResponse,
} from "@/lib/creator-onboard/cookie-helpers";
import { creatorPublicBaseUrl } from "@/lib/creator-onboard/env-web";
import { creatorRobloxAuthorizeUrl } from "@/lib/creator-onboard/roblox-oauth";
import { generatePkcePair } from "@/lib/vfl-verify/pkce";

export async function GET() {
  let env;
  let session;
  try {
    const r = await readCreatorSessionPayload();
    env = r.env;
    session = r.session;
  } catch {
    return NextResponse.json({}, { status: 503 });
  }

  if (!session?.expectedDiscordId) {
    return NextResponse.redirect(
      new URL("/content/creators/onboard", creatorPublicBaseUrl(env)),
    );
  }

  const { verifier, challenge } = generatePkcePair();
  const rbState = randomBytes(16).toString("hex");
  const robloxUrl = creatorRobloxAuthorizeUrl(env, {
    state: rbState,
    codeChallenge: challenge,
  });

  const res = NextResponse.redirect(robloxUrl);
  await setCreatorSessionOnResponse(res, {
    expectedDiscordId: session.expectedDiscordId,
    codeVerifier: verifier,
    applicationId: session.applicationId,
    robloxUserId: session.robloxUserId,
    robloxUsername: session.robloxUsername,
    robloxAvatarUrl: session.robloxAvatarUrl,
    discordUsername: session.discordUsername,
    discordAvatarUrl: session.discordAvatarUrl,
    email: session.email,
  });
  setRobloxOAuthStateOnResponse(res, rbState);
  return res;
}
