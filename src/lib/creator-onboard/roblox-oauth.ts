import type { CreatorWebEnv } from "@/lib/creator-onboard/env-web";
import { creatorPublicBaseUrl } from "@/lib/creator-onboard/env-web";

const ROBLOX_AUTH = "https://apis.roblox.com/oauth/v1/authorize";
const ROBLOX_TOKEN = "https://apis.roblox.com/oauth/v1/token";
const ROBLOX_USERINFO = "https://apis.roblox.com/oauth/v1/userinfo";

export function creatorRobloxRedirectUri(env: CreatorWebEnv): string {
  return `${creatorPublicBaseUrl(env)}/api/content/creators/roblox/callback`;
}

export function creatorRobloxAuthorizeUrl(
  env: CreatorWebEnv,
  opts: { state: string; codeChallenge: string },
): string {
  const u = new URL(ROBLOX_AUTH);
  u.searchParams.set("client_id", env.ROBLOX_OAUTH_CLIENT_ID);
  u.searchParams.set("redirect_uri", creatorRobloxRedirectUri(env));
  u.searchParams.set("scope", "openid profile");
  u.searchParams.set("response_type", "code");
  u.searchParams.set("state", opts.state);
  u.searchParams.set("code_challenge", opts.codeChallenge);
  u.searchParams.set("code_challenge_method", "S256");
  return u.toString();
}

export async function exchangeCreatorRobloxCode(
  env: CreatorWebEnv,
  code: string,
  codeVerifier: string,
): Promise<{
  userId: string;
  username: string;
  avatarUrl: string | null;
} | null> {
  const body = new URLSearchParams({
    client_id: env.ROBLOX_OAUTH_CLIENT_ID,
    client_secret: env.ROBLOX_OAUTH_CLIENT_SECRET,
    grant_type: "authorization_code",
    code,
    code_verifier: codeVerifier,
    redirect_uri: creatorRobloxRedirectUri(env),
  });

  const tokenRes = await fetch(ROBLOX_TOKEN, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!tokenRes.ok) return null;

  const tokenJson = (await tokenRes.json()) as { access_token?: string };
  if (!tokenJson.access_token) return null;

  const uiRes = await fetch(ROBLOX_USERINFO, {
    headers: { Authorization: `Bearer ${tokenJson.access_token}` },
  });
  if (!uiRes.ok) return null;

  const ui = (await uiRes.json()) as {
    sub?: string;
    preferred_username?: string;
    name?: string;
    nickname?: string;
    picture?: string;
  };
  if (!ui.sub) return null;
  const username = (
    ui.preferred_username ??
    ui.name ??
    ui.nickname ??
    ""
  ).trim();
  if (!username) return null;
  const picture =
    typeof ui.picture === "string" && ui.picture.trim()
      ? ui.picture.trim()
      : null;
  return { userId: ui.sub, username, avatarUrl: picture };
}
