import type { CreatorWebEnv } from "@/lib/creator-onboard/env-web";
import { createCreatorSupabaseAdmin } from "@/lib/creator-onboard/supabase-creator";

export async function upsertDraftAfterRoblox(
  env: CreatorWebEnv,
  opts: {
    discordId: string;
    robloxId: string;
    robloxUsername: string;
    robloxAvatarUrl: string | null;
  },
): Promise<{ ok: true; applicationId: string } | { ok: false; reason: string }> {
  const supabase = createCreatorSupabaseAdmin(env);

  const { data: pending } = await supabase
    .from("creator_applications")
    .select("id")
    .eq("discord_id", opts.discordId)
    .eq("status", "pending")
    .maybeSingle();

  if (pending?.id) {
    return { ok: false, reason: "pending_exists" };
  }

  const { data: draft } = await supabase
    .from("creator_applications")
    .select("id")
    .eq("discord_id", opts.discordId)
    .eq("status", "draft")
    .maybeSingle();

  const now = new Date().toISOString();

  if (draft?.id) {
    const { error } = await supabase
      .from("creator_applications")
      .update({
        roblox_id: opts.robloxId,
        roblox_username: opts.robloxUsername,
        roblox_avatar_url: opts.robloxAvatarUrl,
        updated_at: now,
      })
      .eq("id", draft.id);

    if (error) {
      if (error.code === "23505") {
        return { ok: false, reason: "roblox_conflict" };
      }
      console.error("[creator] draft update after roblox:", error);
      return { ok: false, reason: "db_error" };
    }
    return { ok: true, applicationId: draft.id };
  }

  const { data: inserted, error: insErr } = await supabase
    .from("creator_applications")
    .insert({
      discord_id: opts.discordId,
      roblox_id: opts.robloxId,
      roblox_username: opts.robloxUsername,
      roblox_avatar_url: opts.robloxAvatarUrl,
      status: "draft",
      updated_at: now,
    })
    .select("id")
    .single();

  if (insErr || !inserted?.id) {
    if (insErr?.code === "23505") {
      return { ok: false, reason: "roblox_conflict" };
    }
    console.error("[creator] draft insert after roblox:", insErr);
    return { ok: false, reason: "db_error" };
  }

  return { ok: true, applicationId: inserted.id as string };
}

export async function applyDiscordToDraft(
  env: CreatorWebEnv,
  opts: {
    applicationId: string;
    expectedDiscordId: string;
    displayLabel: string;
    discordAvatarUrl: string | null;
    email: string | null;
  },
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const supabase = createCreatorSupabaseAdmin(env);

  const { data: row, error: fetchErr } = await supabase
    .from("creator_applications")
    .select("id, discord_id, status")
    .eq("id", opts.applicationId)
    .maybeSingle();

  if (fetchErr || !row) {
    return { ok: false, reason: "not_found" };
  }

  if (row.discord_id !== opts.expectedDiscordId) {
    return { ok: false, reason: "discord_mismatch" };
  }

  if (row.status !== "draft") {
    return { ok: false, reason: "not_draft" };
  }

  const now = new Date().toISOString();
  const { error } = await supabase
    .from("creator_applications")
    .update({
      discord_username: opts.displayLabel,
      discord_avatar_url: opts.discordAvatarUrl,
      email: opts.email ?? undefined,
      updated_at: now,
    })
    .eq("id", opts.applicationId);

  if (error) {
    console.error("[creator] apply discord:", error);
    return { ok: false, reason: "db_error" };
  }

  return { ok: true };
}
