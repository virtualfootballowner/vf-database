import { config as loadEnv } from "dotenv";
import { z } from "zod";

// Load local env files when running bot outside Next.js runtime.
loadEnv({ path: ".env.local", override: true });
loadEnv({ override: false });

/** Optional channel: treat blank / whitespace as unset (common in Railway UI). */
const optionalOutgoingChannel = z.preprocess(
  (raw) => {
    if (raw == null) return undefined;
    if (typeof raw !== "string") return raw;
    const t = raw.trim();
    return t.length > 0 ? t : undefined;
  },
  z.string().min(1).optional(),
);

const envSchema = z.object({
  DISCORD_BOT_TOKEN: z.string().min(1),
  DISCORD_GUILD_ID: z.string().min(1).transform((s) => s.trim()),
  /** Role granted after user completes website /verify (Discord+Roblox). Replaces third-party verify bots. */
  DISCORD_ROVER_VERIFIED_ROLE_ID: z
    .string()
    .min(1)
    .transform((s) => s.trim()),
  DISCORD_APPROVED_ROLE_ID: z.string().min(1).transform((s) => s.trim()),
  DISCORD_STAFF_REVIEW_CHANNEL_ID: z
    .string()
    .min(1)
    .transform((s) => s.trim()),
  DISCORD_SYNC_LOG_CHANNEL_ID: z
    .string()
    .min(1)
    .transform((s) => s.trim()),
  /** Given to Discord users when an admin /appoint's them as a club manager. */
  DISCORD_TEAM_MANAGER_ROLE_ID: z
    .string()
    .min(1)
    .transform((s) => s.trim()),
  /** Outgoing log: posts when members leave (ban / kick / voluntary). Optional — omit to disable. */
  DISCORD_MEMBER_OUTGOING_CHANNEL_ID: optionalOutgoingChannel,
  SUPABASE_URL: z.url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  ROBLOX_API_BASE_URL: z.string().url().default("https://users.roblox.com"),
  VFL_SITE_URL: z
    .string()
    .url()
    .default("https://myvirtualfootball.com"),
  /**
   * Only this season’s rosters can be updated via `/contract`. Older seasons stay frozen.
   */
  VF_ACTIVE_ROSTER_SEASON: z.preprocess((raw) => {
    if (raw == null || raw === "") return 3;
    const n = Number(raw);
    return Number.isFinite(n) && n >= 1 && n <= 99 ? n : 3;
  }, z.number().int().min(1).max(99)),
});

export const env = envSchema.parse({
  DISCORD_BOT_TOKEN: process.env.DISCORD_BOT_TOKEN,
  DISCORD_GUILD_ID: process.env.DISCORD_GUILD_ID,
  DISCORD_ROVER_VERIFIED_ROLE_ID: process.env.DISCORD_ROVER_VERIFIED_ROLE_ID,
  DISCORD_APPROVED_ROLE_ID: process.env.DISCORD_APPROVED_ROLE_ID,
  DISCORD_STAFF_REVIEW_CHANNEL_ID: process.env.DISCORD_STAFF_REVIEW_CHANNEL_ID,
  DISCORD_SYNC_LOG_CHANNEL_ID: process.env.DISCORD_SYNC_LOG_CHANNEL_ID,
  DISCORD_TEAM_MANAGER_ROLE_ID: process.env.DISCORD_TEAM_MANAGER_ROLE_ID,
  DISCORD_MEMBER_OUTGOING_CHANNEL_ID: process.env.DISCORD_MEMBER_OUTGOING_CHANNEL_ID,
  SUPABASE_URL: process.env.SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  ROBLOX_API_BASE_URL: process.env.ROBLOX_API_BASE_URL,
  VFL_SITE_URL: process.env.VFL_SITE_URL,
  VF_ACTIVE_ROSTER_SEASON: process.env.VF_ACTIVE_ROSTER_SEASON,
});
