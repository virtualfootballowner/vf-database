import type { VerifyEnv } from "@/lib/vfl-verify/load-verify-env";

const DISCORD_API = "https://discord.com/api/v10";

export type ApplyGuildResult =
  | { ok: true }
  | {
      ok: false;
      code: "not_in_guild" | "discord_error" | "nick_failed";
      status?: number;
      detail?: string;
    };

function clampNick(raw: string): string {
  const t = raw.trim();
  if (!t) return t;
  return t.length > 32 ? t.slice(0, 32) : t;
}

/**
 * Sets the member server nickname to their Roblox username, then grants the
 * same "verified" role RoVer used (env DISCORD_ROVER_VERIFIED_ROLE_ID).
 * Triggers the existing GuildMemberUpdate → staff review flow.
 */
export async function applyGuildVerification(
  env: VerifyEnv,
  discordUserId: string,
  robloxUsername: string,
): Promise<ApplyGuildResult> {
  const nick = clampNick(robloxUsername);
  if (!nick) {
    return { ok: false, code: "discord_error", detail: "Missing Roblox username" };
  }

  const headersBot = {
    Authorization: `Bot ${env.DISCORD_BOT_TOKEN}`,
    "Content-Type": "application/json",
  };

  const patchUrl = `${DISCORD_API}/guilds/${env.DISCORD_GUILD_ID}/members/${discordUserId}`;
  const patchRes = await fetch(patchUrl, {
    method: "PATCH",
    headers: headersBot,
    body: JSON.stringify({ nick }),
  });

  if (patchRes.status === 404) {
    return { ok: false, code: "not_in_guild", status: 404 };
  }
  if (!patchRes.ok) {
    const text = await patchRes.text().catch(() => "");
    return {
      ok: false,
      code: patchRes.status === 403 ? "nick_failed" : "discord_error",
      status: patchRes.status,
      detail: text.slice(0, 500),
    };
  }

  const roleUrl = `${DISCORD_API}/guilds/${env.DISCORD_GUILD_ID}/members/${discordUserId}/roles/${env.DISCORD_ROVER_VERIFIED_ROLE_ID}`;
  const putRes = await fetch(roleUrl, {
    method: "PUT",
    headers: { Authorization: `Bot ${env.DISCORD_BOT_TOKEN}` },
  });

  if (!putRes.ok && putRes.status !== 204) {
    const text = await putRes.text().catch(() => "");
    return {
      ok: false,
      code: "discord_error",
      status: putRes.status,
      detail: text.slice(0, 500),
    };
  }

  return { ok: true };
}
