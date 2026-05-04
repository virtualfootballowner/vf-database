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

export type DiscordExchangeFailure = {
  stage: "token" | "userinfo" | "no_token" | "no_user_id";
  status?: number;
  /** Discord OAuth error code, e.g. invalid_client / invalid_grant / invalid_redirect_uri. */
  errorCode?: string;
  /** Truncated error description from Discord (safe to show in URL). */
  errorDescription?: string;
};

export async function exchangeDiscordCode(
  env: VerifyEnv,
  code: string,
): Promise<{ discordUserId: string } | { failure: DiscordExchangeFailure }> {
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
  if (!tokenRes.ok) {
    const errBody = await tokenRes.text().catch(() => "<no body>");
    console.error(
      `[verify] Discord token exchange failed: ${tokenRes.status} ${tokenRes.statusText} client_id=${env.DISCORD_CLIENT_ID} redirect_uri=${redirectUri} body=${errBody}`,
    );
    let parsed: { error?: string; error_description?: string } = {};
    try {
      parsed = JSON.parse(errBody);
    } catch {}
    return {
      failure: {
        stage: "token",
        status: tokenRes.status,
        errorCode: parsed.error,
        errorDescription: parsed.error_description?.slice(0, 200),
      },
    };
  }

  const tokenJson = (await tokenRes.json()) as { access_token?: string };
  if (!tokenJson.access_token) {
    console.error("[verify] Discord token exchange returned no access_token");
    return { failure: { stage: "no_token" } };
  }

  const meRes = await fetch("https://discord.com/api/users/@me", {
    headers: { Authorization: `Bearer ${tokenJson.access_token}` },
  });
  if (!meRes.ok) {
    const errBody = await meRes.text().catch(() => "<no body>");
    console.error(
      `[verify] Discord /users/@me failed: ${meRes.status} ${meRes.statusText} body=${errBody}`,
    );
    return { failure: { stage: "userinfo", status: meRes.status } };
  }
  const me = (await meRes.json()) as { id?: string };
  if (!me.id) {
    console.error("[verify] Discord /users/@me returned no id");
    return { failure: { stage: "no_user_id" } };
  }
  return { discordUserId: me.id };
}
