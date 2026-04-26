import { createClient } from "@supabase/supabase-js";

import { env } from "@/bot/config";

function normalizeSupabaseUrl(rawUrl: string): string {
  const url = new URL(rawUrl);
  url.pathname = url.pathname.replace(/\/rest\/v1\/?$/, "/");
  return url.toString().replace(/\/$/, "");
}

export const supabaseAdmin = createClient(
  normalizeSupabaseUrl(env.SUPABASE_URL),
  env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  },
);
