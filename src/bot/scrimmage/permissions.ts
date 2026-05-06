import {
  PermissionFlagsBits,
  type ChatInputCommandInteraction,
  type GuildMember,
} from "discord.js";

import { env } from "@/bot/config";

/**
 * Permission gates for scrimmage commands. Pulled out of handlers.ts so the
 * queue / draft / ready modules can use them without creating a circular
 * import (handlers.ts re-exports the higher-level slash command entry points
 * which themselves call into the phase modules).
 */

/**
 * "Whitelisted" role per spec — that's the same role staff grant on approval
 * (`DISCORD_APPROVED_ROLE_ID`). Anyone with this role can queue + report.
 */
export function isWhitelistedForScrimmage(
  interaction: ChatInputCommandInteraction,
): boolean {
  if (!interaction.member) return false;
  const member = interaction.member as GuildMember;
  return member.roles.cache.has(env.DISCORD_APPROVED_ROLE_ID);
}

/**
 * Admin gate for `/scrimmage void` — server owner OR Administrator
 * permission only. The auto-finalization pipeline does not need an
 * admin command path; the game is the source of truth.
 */
export function isScrimmageAdmin(
  interaction: ChatInputCommandInteraction,
): boolean {
  if (!interaction.guild) return false;
  if (interaction.guild.ownerId === interaction.user.id) return true;
  return Boolean(
    interaction.memberPermissions?.has(PermissionFlagsBits.Administrator),
  );
}
