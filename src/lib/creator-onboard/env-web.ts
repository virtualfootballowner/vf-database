import { z } from "zod";

import { normalizeSupabaseUrl } from "@/lib/creator-onboard/normalize-supabase-url";

const trimOpt = z.preprocess(
  (raw) => {
    if (raw == null) return undefined;
    if (typeof raw !== "string") return raw;
    const t = raw.trim();
    return t.length > 0 ? t : undefined;
  },
  z.string().min(1).optional(),
);

const schema = z.object({
  SUPABASE_URL: z.string().url().transform(normalizeSupabaseUrl),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  VFL_SITE_URL: z
    .string()
    .url()
    .transform((s) => s.replace(/\/$/, "")),
  DISCORD_CLIENT_ID: z.string().min(1).transform((s) => s.trim()),
  DISCORD_CLIENT_SECRET: z.string().min(1),
  /** Same bot token as /verify — used to post the staff review card on submit. */
  DISCORD_BOT_TOKEN: trimOpt,
  DISCORD_CREATOR_APPROVAL_CHANNEL_ID: trimOpt,
  ROBLOX_OAUTH_CLIENT_ID: z.string().min(1).transform((s) => s.trim()),
  ROBLOX_OAUTH_CLIENT_SECRET: z.string().min(1),
  CREATOR_SESSION_SECRET: z.string().min(32),
});

export type CreatorWebEnv = z.infer<typeof schema>;

let cached: CreatorWebEnv | null = null;

/** Env for Next.js creator onboarding routes. */
export function loadCreatorWebEnv(): CreatorWebEnv {
  if (cached) return cached;
  cached = schema.parse({
    SUPABASE_URL: process.env.SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    VFL_SITE_URL: process.env.VFL_SITE_URL ?? process.env.NEXT_PUBLIC_APP_URL,
    DISCORD_CLIENT_ID: process.env.DISCORD_CLIENT_ID,
    DISCORD_CLIENT_SECRET: process.env.DISCORD_CLIENT_SECRET,
    DISCORD_BOT_TOKEN: process.env.DISCORD_BOT_TOKEN,
    DISCORD_CREATOR_APPROVAL_CHANNEL_ID:
      process.env.DISCORD_CREATOR_APPROVAL_CHANNEL_ID,
    ROBLOX_OAUTH_CLIENT_ID:
      process.env.ROBLOX_OAUTH_CLIENT_ID ?? process.env.ROBLOX_CLIENT_ID,
    ROBLOX_OAUTH_CLIENT_SECRET:
      process.env.ROBLOX_OAUTH_CLIENT_SECRET ?? process.env.ROBLOX_CLIENT_SECRET,
    CREATOR_SESSION_SECRET:
      process.env.CREATOR_SESSION_SECRET ?? process.env.VERIFY_COOKIE_SECRET,
  });
  return cached;
}

export function creatorPublicBaseUrl(env: CreatorWebEnv): string {
  return env.VFL_SITE_URL.trim();
}
