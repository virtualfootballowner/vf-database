import { z } from "zod";

import type { VerifyEnv } from "@/lib/vfl-verify/load-verify-env";

/**
 * Standalone env shape for the **`/verify-media`** flow.
 *
 * Same OAuth credentials as the league-side verify flow (we just register
 * extra redirect URIs), but a **different guild** to rename in and **no role**
 * to grant — by design this flow does nothing but PATCH a member's nickname.
 *
 * Tracks no database, gives no role, requires no env beyond what's already
 * needed for the existing verify.
 */
const schema = z.object({
  DISCORD_BOT_TOKEN: z.string().min(1),
  DISCORD_MEDIA_GUILD_ID: z.string().min(1).transform((s) => s.trim()),
  DISCORD_CLIENT_ID: z.string().min(1).transform((s) => s.trim()),
  DISCORD_CLIENT_SECRET: z.string().min(1),
  ROBLOX_OAUTH_CLIENT_ID: z.string().min(1).transform((s) => s.trim()),
  ROBLOX_OAUTH_CLIENT_SECRET: z.string().min(1),
  VFL_SITE_URL: z
    .string()
    .url()
    .transform((s) => s.replace(/\/$/, "")),
  VERIFY_COOKIE_SECRET: z.string().min(32),
});

export type MediaVerifyEnv = z.infer<typeof schema>;

/**
 * Resolve the media guild id from env. Falls back to
 * `DISCORD_CREATOR_VF_GUILD_ID` (already used by the creator bot) when a
 * dedicated `DISCORD_MEDIA_GUILD_ID` isn't set, so deploys that already point
 * the bot at the media guild don't need a second env var to enable this.
 */
function resolveMediaGuildId(): string | undefined {
  const a = process.env.DISCORD_MEDIA_GUILD_ID?.trim();
  if (a) return a;
  const b = process.env.DISCORD_CREATOR_VF_GUILD_ID?.trim();
  if (b) return b;
  return undefined;
}

export function loadMediaVerifyEnv(): MediaVerifyEnv {
  return schema.parse({
    DISCORD_BOT_TOKEN: process.env.DISCORD_BOT_TOKEN,
    DISCORD_MEDIA_GUILD_ID: resolveMediaGuildId(),
    DISCORD_CLIENT_ID: process.env.DISCORD_CLIENT_ID,
    DISCORD_CLIENT_SECRET: process.env.DISCORD_CLIENT_SECRET,
    ROBLOX_OAUTH_CLIENT_ID: process.env.ROBLOX_OAUTH_CLIENT_ID,
    ROBLOX_OAUTH_CLIENT_SECRET: process.env.ROBLOX_OAUTH_CLIENT_SECRET,
    VFL_SITE_URL: process.env.VFL_SITE_URL,
    VERIFY_COOKIE_SECRET: process.env.VERIFY_COOKIE_SECRET,
  });
}

/**
 * Build a thin `VerifyEnv`-compatible object for reusing the existing OAuth
 * helpers (Discord / Roblox authorize + token exchange). We supply a dummy
 * `DISCORD_ROVER_VERIFIED_ROLE_ID` and the **media** guild id — neither is
 * read by the OAuth helpers; only `applyMediaGuildRename` reads them.
 */
export function mediaVerifyEnvAsVerifyEnv(env: MediaVerifyEnv): VerifyEnv {
  return {
    DISCORD_BOT_TOKEN: env.DISCORD_BOT_TOKEN,
    DISCORD_GUILD_ID: env.DISCORD_MEDIA_GUILD_ID,
    DISCORD_ROVER_VERIFIED_ROLE_ID: "unused-for-media-flow",
    DISCORD_CLIENT_ID: env.DISCORD_CLIENT_ID,
    DISCORD_CLIENT_SECRET: env.DISCORD_CLIENT_SECRET,
    ROBLOX_OAUTH_CLIENT_ID: env.ROBLOX_OAUTH_CLIENT_ID,
    ROBLOX_OAUTH_CLIENT_SECRET: env.ROBLOX_OAUTH_CLIENT_SECRET,
    VFL_SITE_URL: env.VFL_SITE_URL,
    VERIFY_COOKIE_SECRET: env.VERIFY_COOKIE_SECRET,
  };
}
