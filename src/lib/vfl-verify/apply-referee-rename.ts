import type { RefereeVerifyEnv } from "@/lib/vfl-verify/load-referee-verify-env";

const DISCORD_API = "https://discord.com/api/v10";

export type ApplyRefereeRenameResult =
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

/** Referee verify: Roblox OAuth nickname only — no role until staff approve. */
export async function applyRefereeGuildRename(
  env: RefereeVerifyEnv,
  discordUserId: string,
  robloxUsername: string,
): Promise<ApplyRefereeRenameResult> {
  const nick = clampNick(robloxUsername);
  if (!nick) {
    return {
      ok: false,
      code: "discord_error",
      detail: "Missing Roblox username",
    };
  }

  const patchUrl = `${DISCORD_API}/guilds/${env.DISCORD_REFEREE_GUILD_ID}/members/${discordUserId}`;
  const patchRes = await fetch(patchUrl, {
    method: "PATCH",
    headers: {
      Authorization: `Bot ${env.DISCORD_BOT_TOKEN}`,
      "Content-Type": "application/json",
    },
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

  return { ok: true };
}
