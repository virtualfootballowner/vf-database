import type { SupabaseClient } from "@supabase/supabase-js";

/** Upsert VF ban info for the player row whose `discord_id` matches the banned user. */
export async function setPlayerDiscordBanFromGuild(
  supabase: SupabaseClient,
  discordUserId: string,
  opts: {
    at: Date;
    /** Omit to leave `discord_ban_reason` unchanged (avoids gateway races wiping `/ban`). */
    reason?: string | null;
    /** Omit to leave `discord_banned_until` unchanged (gateway sync). */
    until?: Date | null;
    /** When provided (including `null`), updates `discord_ban_bail_amount`. When omitted, column unchanged. */
    bailAmount?: number | null;
  },
): Promise<void> {
  const patch: Record<string, unknown> = {
    discord_banned_at: opts.at.toISOString(),
  };
  if (Object.prototype.hasOwnProperty.call(opts, "reason")) {
    patch.discord_ban_reason = opts.reason?.trim() || null;
  }
  if (opts.until !== undefined) {
    patch.discord_banned_until = opts.until
      ? opts.until.toISOString()
      : null;
  }
  if (Object.prototype.hasOwnProperty.call(opts, "bailAmount")) {
    patch.discord_ban_bail_amount = opts.bailAmount;
  }
  const { error } = await supabase
    .from("players")
    .update(patch)
    .eq("discord_id", discordUserId);

  if (error) throw error;
}

/** Clear VF ban fields when the ban is lifted. */
export async function clearPlayerDiscordBanFromGuild(
  supabase: SupabaseClient,
  discordUserId: string,
): Promise<void> {
  const { error } = await supabase
    .from("players")
    .update({
      discord_banned_at: null,
      discord_ban_reason: null,
      discord_banned_until: null,
      discord_ban_bail_amount: null,
    })
    .eq("discord_id", discordUserId);

  if (error) throw error;
}
