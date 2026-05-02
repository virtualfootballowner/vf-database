import type { VerifyEnv } from "@/lib/vfl-verify/load-verify-env";
import { verifyPublicBaseUrl } from "@/lib/vfl-verify/load-verify-env";

export function discordAuthorizeUrl(
  env: VerifyEnv,
  state: string,
): string {
  const redirectUri = `${verifyPublicBaseUrl(env)}/api/verify/discord/callback`;
  const u = new URL("https://discord.com/api/oauth2/authorize");
  u.searchParams.set("client_id", env.DISCORD_CLIENT_ID);
  u.searchParams.set("redirect_uri", redirectUri);
  u.searchParams.set("response_type", "code");
  u.searchParams.set("scope", "identify");
  u.searchParams.set("state", state);
  return u.toString();
}

export async function exchangeDiscordCode(
  env: VerifyEnv,
  code: string,
): Promise<{ discordUserId: string } | null> {
  const redirectUri = `${verifyPublicBaseUrl(env)}/api/verify/discord/callback`;
  const body = new URLSearchParams({
    client_id: env.DISCORD_CLIENT_ID,
    client_secret: env.DISCORD_CLIENT_SECRET,
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
  });

  const tokenRes = await fetch("https://discord.com/api/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!tokenRes.ok) return null;

  const tokenJson = (await tokenRes.json()) as { access_token?: string };
  if (!tokenJson.access_token) return null;

  const meRes = await fetch("https://discord.com/api/users/@me", {
    headers: { Authorization: `Bearer ${tokenJson.access_token}` },
  });
  if (!meRes.ok) return null;
  const me = (await meRes.json()) as { id?: string };
  if (!me.id) return null;
  return { discordUserId: me.id };
}
