/**
 * Tiny Discord REST helpers for server-side code (Vercel API routes,
 * scripts) that don't have a `discord.js` Client in scope.
 *
 * Reads `DISCORD_BOT_TOKEN` from env on each call so a missing token
 * surfaces a clear error in the response body instead of crashing
 * the route at import time.
 */

const DISCORD_API = "https://discord.com/api/v10";

export type DiscordEmbed = {
  title?: string;
  description?: string;
  color?: number;
  fields?: { name: string; value: string; inline?: boolean }[];
  footer?: { text: string };
  timestamp?: string;
};

export type DiscordMessagePayload = {
  content?: string;
  embeds?: DiscordEmbed[];
  /** When editing, set to `[]` to drop existing buttons / select menus. */
  components?: unknown[];
  /** Roles/users to allow pinging. Pass `{ parse: [] }` to suppress all pings. */
  allowed_mentions?: { parse?: string[]; users?: string[]; roles?: string[] };
};

function authHeader(): string {
  const token = process.env.DISCORD_BOT_TOKEN;
  if (!token) {
    throw new Error(
      "DISCORD_BOT_TOKEN missing — Discord REST calls disabled in this environment.",
    );
  }
  return `Bot ${token}`;
}

/**
 * Edit an existing message in a channel. Always returns void; failures
 * are logged but never thrown (Discord REST is best-effort from the API).
 */
export async function discordEditMessage(
  channelId: string,
  messageId: string,
  payload: DiscordMessagePayload,
): Promise<{ ok: boolean; status: number; error?: string }> {
  try {
    const res = await fetch(
      `${DISCORD_API}/channels/${channelId}/messages/${messageId}`,
      {
        method: "PATCH",
        headers: {
          Authorization: authHeader(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      },
    );
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error(
        `[discord-rest] PATCH msg ${messageId} → ${res.status}: ${text.slice(0, 400)}`,
      );
      return { ok: false, status: res.status, error: text };
    }
    return { ok: true, status: res.status };
  } catch (err) {
    console.error("[discord-rest] PATCH error:", err);
    return {
      ok: false,
      status: 0,
      error: err instanceof Error ? err.message : "unknown",
    };
  }
}

export async function discordPostMessage(
  channelId: string,
  payload: DiscordMessagePayload,
): Promise<{ ok: boolean; status: number; messageId?: string; error?: string }> {
  try {
    const res = await fetch(`${DISCORD_API}/channels/${channelId}/messages`, {
      method: "POST",
      headers: {
        Authorization: authHeader(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error(
        `[discord-rest] POST channel ${channelId} → ${res.status}: ${text.slice(0, 400)}`,
      );
      return { ok: false, status: res.status, error: text };
    }
    const json = (await res.json().catch(() => null)) as { id?: string } | null;
    return { ok: true, status: res.status, messageId: json?.id };
  } catch (err) {
    console.error("[discord-rest] POST error:", err);
    return {
      ok: false,
      status: 0,
      error: err instanceof Error ? err.message : "unknown",
    };
  }
}
