import { config as loadEnv } from "dotenv";
import { z } from "zod";

// Load local env files when running bot outside Next.js runtime.
loadEnv({ path: ".env.local", override: true });
loadEnv({ override: false });

const envSchema = z.object({
  DISCORD_BOT_TOKEN: z.string().min(1),
  DISCORD_GUILD_ID: z.string().min(1),
  DISCORD_ROVER_VERIFIED_ROLE_ID: z.string().min(1),
  DISCORD_APPROVED_ROLE_ID: z.string().min(1),
  DISCORD_STAFF_REVIEW_CHANNEL_ID: z.string().min(1),
  DISCORD_SYNC_LOG_CHANNEL_ID: z.string().min(1),
  /** Outgoing log: posts when members leave (ban / kick / voluntary). Optional — omit to disable. */
  DISCORD_MEMBER_OUTGOING_CHANNEL_ID: z.string().min(1).optional(),
  SUPABASE_URL: z.url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  ROBLOX_API_BASE_URL: z.string().url().default("https://users.roblox.com"),
  VFL_SITE_URL: z
    .string()
    .url()
    .default("https://myvirtualfootball.com"),
});

export const env = envSchema.parse({
  DISCORD_BOT_TOKEN: process.env.DISCORD_BOT_TOKEN,
  DISCORD_GUILD_ID: process.env.DISCORD_GUILD_ID,
  DISCORD_ROVER_VERIFIED_ROLE_ID: process.env.DISCORD_ROVER_VERIFIED_ROLE_ID,
  DISCORD_APPROVED_ROLE_ID: process.env.DISCORD_APPROVED_ROLE_ID,
  DISCORD_STAFF_REVIEW_CHANNEL_ID: process.env.DISCORD_STAFF_REVIEW_CHANNEL_ID,
  DISCORD_SYNC_LOG_CHANNEL_ID: process.env.DISCORD_SYNC_LOG_CHANNEL_ID,
  DISCORD_MEMBER_OUTGOING_CHANNEL_ID: process.env.DISCORD_MEMBER_OUTGOING_CHANNEL_ID,
  SUPABASE_URL: process.env.SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  ROBLOX_API_BASE_URL: process.env.ROBLOX_API_BASE_URL,
  VFL_SITE_URL: process.env.VFL_SITE_URL,
});
