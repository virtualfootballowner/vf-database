import type { GuildMember } from "discord.js";

import { env } from "@/bot/config";
import { upsertVerifiedPlayer } from "@/lib/player-sync";
import {
  extractRobloxUsername,
  resolveRobloxIdentity,
} from "@/lib/roblox";

export async function syncMemberIfVerified(
  member: GuildMember,
): Promise<void> {
  if (!member.roles.cache.has(env.DISCORD_ROVER_VERIFIED_ROLE_ID)) {
    return;
  }

  const rawName =
    member.nickname ??
    member.user.displayName ??
    member.user.username ??
    null;

  if (!rawName) return;

  const robloxUsername = extractRobloxUsername(rawName);
  if (!robloxUsername) return;

  const identity = await resolveRobloxIdentity(
    robloxUsername,
    env.ROBLOX_API_BASE_URL,
  );
  if (!identity) return;

  await upsertVerifiedPlayer({
    discordId: member.id,
    discordUsername: member.user.username,
    robloxUsername: identity.username,
    robloxUserId: identity.userId,
  });
}
