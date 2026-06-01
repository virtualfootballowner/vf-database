import type { SupabaseClient } from "@supabase/supabase-js";

export async function claimFanJoinAlertSlot(
  supabase: SupabaseClient,
  input: { matchId: string; channelId: string },
): Promise<boolean> {
  const { error } = await supabase.from("match_fan_join_channel_alerts").insert({
    match_id: input.matchId,
    channel_id: input.channelId,
  });

  if (error) {
    if ((error as { code?: string }).code === "23505") return false;
    throw error;
  }
  return true;
}

export async function releaseFanJoinAlertSlot(
  supabase: SupabaseClient,
  input: { matchId: string; channelId: string },
): Promise<void> {
  const { error } = await supabase
    .from("match_fan_join_channel_alerts")
    .delete()
    .eq("match_id", input.matchId)
    .eq("channel_id", input.channelId);
  if (error) throw error;
}
