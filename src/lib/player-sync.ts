import { supabaseAdmin } from "@/lib/supabase-admin";

export type PlayerUpsertInput = {
  discordId: string;
  discordUsername: string;
  robloxUsername: string;
  robloxUserId: string;
};

export async function upsertVerifiedPlayer(input: PlayerUpsertInput) {
  const existingDiscordMapping = await supabaseAdmin
    .from("players")
    .select("roblox_user_id")
    .eq("discord_id", input.discordId)
    .limit(1)
    .maybeSingle();

  if (existingDiscordMapping.error) {
    throw new Error(existingDiscordMapping.error.message);
  }

  if (
    existingDiscordMapping.data?.roblox_user_id &&
    existingDiscordMapping.data.roblox_user_id !== input.robloxUserId
  ) {
    throw new Error(
      `Collision: discord_id ${input.discordId} is already linked to roblox_user_id ${existingDiscordMapping.data.roblox_user_id}.`,
    );
  }

  const existingIdentity = await supabaseAdmin
    .from("players")
    .select("discord_id")
    .eq("roblox_user_id", input.robloxUserId)
    .neq("discord_id", input.discordId)
    .limit(1);

  if (existingIdentity.error) {
    throw new Error(existingIdentity.error.message);
  }

  if ((existingIdentity.data ?? []).length > 0) {
    throw new Error(
      `Collision: roblox_user_id ${input.robloxUserId} is already linked to a different Discord account.`,
    );
  }

  const result = await supabaseAdmin.from("players").upsert(
    {
      discord_id: input.discordId,
      discord_username: input.discordUsername,
      roblox_username: input.robloxUsername,
      roblox_user_id: input.robloxUserId,
      status: "active",
    },
    { onConflict: "discord_id" },
  );

  if (result.error) {
    throw new Error(result.error.message);
  }
}
