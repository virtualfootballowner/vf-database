import { createCreatorSupabaseAdmin } from "@/lib/creator-onboard/supabase-creator";
import type { CreatorWebEnv } from "@/lib/creator-onboard/env-web";

export type ApprovedCreatorDirectoryRow = {
  id: string;
  discord_username: string | null;
  roblox_username: string;
  roblox_avatar_url: string | null;
  tiktok_handle: string | null;
  youtube_handle: string | null;
  country: string | null;
  approved_at: string;
};

/** Public-safe fields only — no email, age, or discord_id. */
export async function listApprovedCreatorsForDirectory(
  env: CreatorWebEnv,
): Promise<ApprovedCreatorDirectoryRow[]> {
  const supabase = createCreatorSupabaseAdmin(env);
  const { data, error } = await supabase
    .from("creator_applications")
    .select(
      "id, discord_username, roblox_username, roblox_avatar_url, tiktok_handle, youtube_handle, country, approved_at",
    )
    .eq("status", "approved")
    .order("approved_at", { ascending: false });

  if (error) {
    console.error("[creator] directory list:", error);
    return [];
  }

  return (data ?? []) as ApprovedCreatorDirectoryRow[];
}
