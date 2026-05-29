import type { GuildMember } from "discord.js";

import { env } from "@/bot/config";
import { isMediaGuild } from "@/bot/referees/config";

export function memberHasVerifiedAccess(member: GuildMember): boolean {
  if (member.roles.cache.has(env.DISCORD_ROVER_VERIFIED_ROLE_ID)) {
    return true;
  }
  if (
    isMediaGuild(member.guild.id) &&
    member.roles.cache.has(env.DISCORD_MEDIA_VERIFIED_ROLE_ID)
  ) {
    return true;
  }
  return false;
}

export function verifiedAccessHint(guildId: string | null): string {
  if (isMediaGuild(guildId)) {
    return "You need the media verified role first. Run `/postverify-media` in the verify channel for the link.";
  }
  return "You need to verify on the website first. Run `/postverify` in the verify channel for the link.";
}
