import type { VerifyEnv } from "@/lib/vfl-verify/load-verify-env";
import { verifyPublicBaseUrl } from "@/lib/vfl-verify/load-verify-env";

const ROBLOX_AUTH = "https://apis.roblox.com/oauth/v1/authorize";
const ROBLOX_TOKEN = "https://apis.roblox.com/oauth/v1/token";
const ROBLOX_USERINFO = "https://apis.roblox.com/oauth/v1/userinfo";

const DEFAULT_ROBLOX_REDIRECT_PATH = "/api/verify/roblox/callback";

export function robloxAuthorizeUrl(
  env: VerifyEnv,
  opts: {
    state: string;
    codeChallenge: string;
    redirectPath?: string;
  },
): string {
  const redirectUri = `${verifyPublicBaseUrl(env)}${
    opts.redirectPath ?? DEFAULT_ROBLOX_REDIRECT_PATH
  }`;
  const u = new URL(ROBLOX_AUTH);
  u.searchParams.set("client_id", env.ROBLOX_OAUTH_CLIENT_ID);
  u.searchParams.set("redirect_uri", redirectUri);
  u.searchParams.set("scope", "openid profile");
  u.searchParams.set("response_type", "code");
  u.searchParams.set("state", opts.state);
  u.searchParams.set("code_challenge", opts.codeChallenge);
  u.searchParams.set("code_challenge_method", "S256");
  return u.toString();
}

export async function exchangeRobloxCode(
  env: VerifyEnv,
  code: string,
  codeVerifier: string,
  redirectPath: string = DEFAULT_ROBLOX_REDIRECT_PATH,
): Promise<{ userId: string; username: string } | null> {
  const redirectUri = `${verifyPublicBaseUrl(env)}${redirectPath}`;
  const body = new URLSearchParams({
    client_id: env.ROBLOX_OAUTH_CLIENT_ID,
    client_secret: env.ROBLOX_OAUTH_CLIENT_SECRET,
    grant_type: "authorization_code",
    code,
    code_verifier: codeVerifier,
    redirect_uri: redirectUri,
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
  };
  if (!ui.sub) return null;
  const username = (
    ui.preferred_username ??
    ui.name ??
    ui.nickname ??
    ""
  ).trim();
  if (!username) return null;
  return { userId: ui.sub, username };
}
