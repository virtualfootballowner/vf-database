import { z } from "zod";

import type { VerifyEnv } from "@/lib/vfl-verify/load-verify-env";

const DEFAULT_REFEREE_GUILD_ID = "1506682501605883995";

const schema = z.object({
  DISCORD_BOT_TOKEN: z.string().min(1),
  DISCORD_REFEREE_GUILD_ID: z.string().min(1).transform((s) => s.trim()),
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

export type RefereeVerifyEnv = z.infer<typeof schema>;

export function loadRefereeVerifyEnv(): RefereeVerifyEnv {
  const guildId =
    process.env.DISCORD_REFEREE_GUILD_ID?.trim() || DEFAULT_REFEREE_GUILD_ID;

  return schema.parse({
    DISCORD_BOT_TOKEN: process.env.DISCORD_BOT_TOKEN,
    DISCORD_REFEREE_GUILD_ID: guildId,
    DISCORD_CLIENT_ID: process.env.DISCORD_CLIENT_ID,
    DISCORD_CLIENT_SECRET: process.env.DISCORD_CLIENT_SECRET,
    ROBLOX_OAUTH_CLIENT_ID: process.env.ROBLOX_OAUTH_CLIENT_ID,
    ROBLOX_OAUTH_CLIENT_SECRET: process.env.ROBLOX_OAUTH_CLIENT_SECRET,
    VFL_SITE_URL: process.env.VFL_SITE_URL,
    VERIFY_COOKIE_SECRET: process.env.VERIFY_COOKIE_SECRET,
  });
}

export function refereeVerifyEnvAsVerifyEnv(env: RefereeVerifyEnv): VerifyEnv {
  return {
    DISCORD_BOT_TOKEN: env.DISCORD_BOT_TOKEN,
    DISCORD_GUILD_ID: env.DISCORD_REFEREE_GUILD_ID,
    DISCORD_ROVER_VERIFIED_ROLE_ID: "unused",
    DISCORD_CLIENT_ID: env.DISCORD_CLIENT_ID,
    DISCORD_CLIENT_SECRET: env.DISCORD_CLIENT_SECRET,
    ROBLOX_OAUTH_CLIENT_ID: env.ROBLOX_OAUTH_CLIENT_ID,
    ROBLOX_OAUTH_CLIENT_SECRET: env.ROBLOX_OAUTH_CLIENT_SECRET,
    VFL_SITE_URL: env.VFL_SITE_URL,
    VERIFY_COOKIE_SECRET: env.VERIFY_COOKIE_SECRET,
  };
}
