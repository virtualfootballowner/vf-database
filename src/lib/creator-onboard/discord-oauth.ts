import type { CreatorWebEnv } from "@/lib/creator-onboard/env-web";
import { creatorPublicBaseUrl } from "@/lib/creator-onboard/env-web";

export function creatorDiscordRedirectUri(env: CreatorWebEnv): string {
  return `${creatorPublicBaseUrl(env)}/api/content/creators/discord/callback`;
}

export function creatorDiscordAuthorizeUrl(
  env: CreatorWebEnv,
  state: string,
): string {
  const u = new URL("https://discord.com/api/oauth2/authorize");
  u.searchParams.set("client_id", env.DISCORD_CLIENT_ID);
  u.searchParams.set("redirect_uri", creatorDiscordRedirectUri(env));
  u.searchParams.set("response_type", "code");
  u.searchParams.set(
    "scope",
    ["identify", "email", "guilds.join"].join(" "),
  );
  u.searchParams.set("state", state);
  return u.toString();
}

export type CreatorDiscordProfile = {
  discordUserId: string;
  username: string;
  globalName: string | null;
  avatarUrl: string | null;
  email: string | null;
};

export type CreatorDiscordExchangeFailure = {
  stage: "token" | "userinfo" | "no_token" | "no_user_id";
  status?: number;
  errorCode?: string;
  errorDescription?: string;
};

export async function exchangeCreatorDiscordCode(
  env: CreatorWebEnv,
  code: string,
): Promise<
  CreatorDiscordProfile | { failure: CreatorDiscordExchangeFailure }
> {
  const body = new URLSearchParams({
    client_id: env.DISCORD_CLIENT_ID,
    client_secret: env.DISCORD_CLIENT_SECRET,
    grant_type: "authorization_code",
    code,
    redirect_uri: creatorDiscordRedirectUri(env),
  });

  const tokenRes = await fetch("https://discord.com/api/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!tokenRes.ok) {
    const errBody = await tokenRes.text().catch(() => "");
    let parsed: { error?: string; error_description?: string } = {};
    try {
      parsed = JSON.parse(errBody);
    } catch {
      /* ignore */
    }
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
    return { failure: { stage: "no_token" } };
  }

  const meRes = await fetch("https://discord.com/api/users/@me", {
    headers: { Authorization: `Bearer ${tokenJson.access_token}` },
  });
  if (!meRes.ok) {
    return { failure: { stage: "userinfo", status: meRes.status } };
  }

  const me = (await meRes.json()) as {
    id?: string;
    username?: string;
    global_name?: string | null;
    avatar?: string | null;
    email?: string | null;
  };
  if (!me.id) {
    return { failure: { stage: "no_user_id" } };
  }

  const avatarUrl =
    me.avatar != null && me.avatar.length > 0
      ? `https://cdn.discordapp.com/avatars/${me.id}/${me.avatar}.webp?size=128`
      : null;

  return {
    discordUserId: me.id,
    username: me.username ?? "unknown",
    globalName:
      typeof me.global_name === "string" && me.global_name.trim()
        ? me.global_name.trim()
        : null,
    avatarUrl,
    email:
      typeof me.email === "string" && me.email.includes("@")
        ? me.email.trim()
        : null,
  };
}
