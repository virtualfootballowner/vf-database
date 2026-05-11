import { createClient } from "@supabase/supabase-js";

import type { CreatorWebEnv } from "@/lib/creator-onboard/env-web";

export function createCreatorSupabaseAdmin(env: CreatorWebEnv) {
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
