import { NextResponse } from "next/server";

import {
  clearCreatorOAuthCookies,
  getDiscordOAuthStateCookie,
  readCreatorSessionPayload,
  setCreatorSessionOnResponse,
} from "@/lib/creator-onboard/cookie-helpers";
import { applyDiscordToDraft } from "@/lib/creator-onboard/db-draft";
import { exchangeCreatorDiscordCode } from "@/lib/creator-onboard/discord-oauth";
import { creatorPublicBaseUrl } from "@/lib/creator-onboard/env-web";

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
    return failRedirect(base, "discord_denied");
  }

  const stored = await getDiscordOAuthStateCookie();
  if (!stored || stored !== state) {
    return failRedirect(base, "discord_state");
  }

  const { session } = await readCreatorSessionPayload();
  if (!session?.expectedDiscordId || !session.applicationId) {
    return failRedirect(base, "session");
  }

  const exchanged = await exchangeCreatorDiscordCode(env, code);
  if ("failure" in exchanged) {
    return failRedirect(base, "discord_token");
  }

  if (exchanged.discordUserId !== session.expectedDiscordId) {
    return failRedirect(base, "discord_mismatch");
  }

  const displayLabel =
    exchanged.globalName?.trim() ||
    exchanged.username ||
    exchanged.discordUserId;

  const applied = await applyDiscordToDraft(env, {
    applicationId: session.applicationId,
    expectedDiscordId: session.expectedDiscordId,
    displayLabel,
    discordAvatarUrl: exchanged.avatarUrl,
    email: exchanged.email,
  });

  if (!applied.ok) {
    const m: Record<string, string> = {
      not_found: "session",
      discord_mismatch: "discord_mismatch",
      not_draft: "not_draft",
      db_error: "db",
    };
    return failRedirect(base, m[applied.reason] ?? "db");
  }

  const res = NextResponse.redirect(
    new URL("/content/creators/onboard/details", base),
  );
  await setCreatorSessionOnResponse(res, {
    expectedDiscordId: session.expectedDiscordId,
    applicationId: session.applicationId,
    robloxUserId: session.robloxUserId,
    robloxUsername: session.robloxUsername,
    robloxAvatarUrl: session.robloxAvatarUrl ?? null,
    discordUsername: displayLabel,
    discordAvatarUrl: exchanged.avatarUrl,
    email: exchanged.email,
  });
  res.cookies.set("vf_creator_dc_st", "", {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return res;
}
