import { supabaseAdmin } from "@/lib/supabase-admin";

/** Discord ↔ Roblox mapping disagrees with what's stored (nickname drift, alt accounts, or stale DB). */
export class PlayerIdentityCollisionError extends Error {
  override readonly name = "PlayerIdentityCollisionError";
  readonly code = "PLAYER_IDENTITY_COLLISION" as const;

  constructor(
    message: string,
    public readonly kind:
      | "discord_maps_other_roblox"
      | "roblox_maps_other_discord",
    public readonly details: Readonly<Record<string, string>>,
  ) {
    super(message);
  }
}

export type PlayerUpsertInput = {
  discordId: string;
  discordUsername: string;
  robloxUsername: string;
  robloxUserId: string;
};

export async function upsertVerifiedPlayer(input: PlayerUpsertInput) {
  const statsOnly = await supabaseAdmin
    .from("players")
    .select("id")
    .eq("roblox_user_id", input.robloxUserId)
    .is("discord_id", null)
    .maybeSingle();

  if (statsOnly.error) {
    throw new Error(statsOnly.error.message);
  }

  if (statsOnly.data?.id) {
    const merged = await supabaseAdmin
      .from("players")
      .update({
        discord_id: input.discordId,
        discord_username: input.discordUsername,
        roblox_username: input.robloxUsername,
      })
      .eq("id", statsOnly.data.id);

    if (merged.error) {
      throw new Error(merged.error.message);
    }
    return;
  }

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
    throw new PlayerIdentityCollisionError(
      [
        `This Discord account is already linked to Roblox user id \`${existingDiscordMapping.data.roblox_user_id}\` in the database,`,
        `but the member’s display name / nickname resolved to \`${input.robloxUsername}\` (id \`${input.robloxUserId}\`).`,
        `Update their Discord nickname to match the linked Roblox name, or correct the player row in Supabase if they legitimately changed Roblox accounts (may need a DB migration; roblox_user_id is locked after link).`,
      ].join(" "),
      "discord_maps_other_roblox",
      {
        discord_id: input.discordId,
        db_roblox_user_id: existingDiscordMapping.data.roblox_user_id,
        resolved_roblox_user_id: input.robloxUserId,
        resolved_roblox_username: input.robloxUsername,
      },
    );
  }

  const existingIdentity = await supabaseAdmin
    .from("players")
    .select("discord_id")
    .eq("roblox_user_id", input.robloxUserId)
    .not("discord_id", "is", null)
    .neq("discord_id", input.discordId)
    .limit(1);

  if (existingIdentity.error) {
    throw new Error(existingIdentity.error.message);
  }

  if ((existingIdentity.data ?? []).length > 0) {
    throw new PlayerIdentityCollisionError(
      `Roblox user id \`${input.robloxUserId}\` is already linked to a different Discord account in the database.`,
      "roblox_maps_other_discord",
      {
        discord_id: input.discordId,
        resolved_roblox_user_id: input.robloxUserId,
        resolved_roblox_username: input.robloxUsername,
      },
    );
  }

  const result = await supabaseAdmin.from("players").upsert(
    {
      discord_id: input.discordId,
      discord_username: input.discordUsername,
      roblox_username: input.robloxUsername,
      roblox_user_id: input.robloxUserId,
    },
    { onConflict: "discord_id" },
  );

  if (result.error) {
    throw new Error(result.error.message);
  }
}
