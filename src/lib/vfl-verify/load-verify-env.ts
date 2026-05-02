import { z } from "zod";

const schema = z.object({
  DISCORD_BOT_TOKEN: z.string().min(1),
  DISCORD_GUILD_ID: z.string().min(1).transform((s) => s.trim()),
  DISCORD_ROVER_VERIFIED_ROLE_ID: z.string().min(1).transform((s) => s.trim()),
  DISCORD_CLIENT_ID: z.string().min(1).transform((s) => s.trim()),
  DISCORD_CLIENT_SECRET: z.string().min(1),
  ROBLOX_OAUTH_CLIENT_ID: z.string().min(1).transform((s) => s.trim()),
  ROBLOX_OAUTH_CLIENT_SECRET: z.string().min(1),
  VFL_SITE_URL: z.string().url().transform((s) => s.replace(/\/$/, "")),
  VERIFY_COOKIE_SECRET: z.string().min(32),
});

export type VerifyEnv = z.infer<typeof schema>;

export function loadVerifyEnv(): VerifyEnv {
  return schema.parse({
    DISCORD_BOT_TOKEN: process.env.DISCORD_BOT_TOKEN,
    DISCORD_GUILD_ID: process.env.DISCORD_GUILD_ID,
    DISCORD_ROVER_VERIFIED_ROLE_ID: process.env.DISCORD_ROVER_VERIFIED_ROLE_ID,
    DISCORD_CLIENT_ID: process.env.DISCORD_CLIENT_ID,
    DISCORD_CLIENT_SECRET: process.env.DISCORD_CLIENT_SECRET,
    ROBLOX_OAUTH_CLIENT_ID: process.env.ROBLOX_OAUTH_CLIENT_ID,
    ROBLOX_OAUTH_CLIENT_SECRET: process.env.ROBLOX_OAUTH_CLIENT_SECRET,
    VFL_SITE_URL: process.env.VFL_SITE_URL,
    VERIFY_COOKIE_SECRET: process.env.VERIFY_COOKIE_SECRET,
  });
}

export function verifyPublicBaseUrl(env: VerifyEnv): string {
  return env.VFL_SITE_URL.trim();
}
