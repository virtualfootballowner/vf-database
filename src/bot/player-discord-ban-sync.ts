import type { SupabaseClient } from "@supabase/supabase-js";

/** Upsert ban info for the player row whose `discord_id` matches the banned user. */
export async function setPlayerDiscordBanFromGuild(
  supabase: SupabaseClient,
  discordUserId: string,
  opts: {
    at: Date;
    reason: string | null;
    /** Omit to leave `discord_banned_until` unchanged (gateway sync). */
    until?: Date | null;
  },
): Promise<void> {
  const reason = opts.reason?.trim() || null;
  const patch: Record<string, unknown> = {
    discord_banned_at: opts.at.toISOString(),
    discord_ban_reason: reason,
  };
  if (opts.until !== undefined) {
    patch.discord_banned_until = opts.until
      ? opts.until.toISOString()
      : null;
  }
  const { error } = await supabase
    .from("players")
    .update(patch)
    .eq("discord_id", discordUserId);

  if (error) throw error;
}

/** Clear ban fields when the user is unbanned from the guild. */
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
    })
    .eq("discord_id", discordUserId);

  if (error) throw error;
}
