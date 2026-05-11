import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";

import {
  readCreatorSessionPayload,
  setDiscordOAuthStateOnResponse,
} from "@/lib/creator-onboard/cookie-helpers";
import { creatorDiscordAuthorizeUrl } from "@/lib/creator-onboard/discord-oauth";
import { creatorPublicBaseUrl } from "@/lib/creator-onboard/env-web";

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

  if (!session?.expectedDiscordId || !session.applicationId) {
    return NextResponse.redirect(
      new URL("/content/creators/onboard", creatorPublicBaseUrl(env)),
    );
  }

  const dcState = randomBytes(24).toString("hex");
  const discordUrl = creatorDiscordAuthorizeUrl(env, dcState);
  const res = NextResponse.redirect(discordUrl);
  setDiscordOAuthStateOnResponse(res, dcState);
  return res;
}
