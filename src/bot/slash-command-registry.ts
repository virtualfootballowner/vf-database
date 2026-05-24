import {
  creatorLeaderboardCommand,
  creatorPostedCommand,
  creatorPostRemoveCommand,
  creatorProfileCommand,
  creatorRemoveFromDbCommand,
  creatorSwapCommand,
  onboardMediaCommand,
} from "@/bot/creator-onboard";
import { updateContentCommand } from "@/bot/creator-content-sync";
import { mediaJobCommand } from "@/bot/media-jobs";
import {
  leagueSlashCommandDefinitions,
} from "@/bot/commands";
import { refereeSlashCommandDefinitions } from "@/bot/referees/commands";
import {
  isRefereeGuild,
  leagueGuildId,
  mediaGuildId,
} from "@/bot/referees/config";
import { PermissionFlagsBits, SlashCommandBuilder } from "discord.js";

/** VF Media server — media/creator commands without league moderation noise. */
export const mediaGuildSlashCommandDefinitions = [
  new SlashCommandBuilder()
    .setName("postverify-media")
    .setDescription(
      "Post the VF Media nickname-verify card (rename only, no roles or DB)",
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .toJSON(),
  new SlashCommandBuilder()
    .setName("postverify-media-staff")
    .setDescription(
      "Post the VF Media staff verify + application card (onboarding, no DB)",
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .toJSON(),
  onboardMediaCommand,
  creatorProfileCommand,
  creatorLeaderboardCommand,
  creatorPostedCommand,
  creatorPostRemoveCommand,
  creatorRemoveFromDbCommand,
  creatorSwapCommand,
  updateContentCommand,
  mediaJobCommand,
  new SlashCommandBuilder()
    .setName("help")
    .setDescription("Post the VFL bot command index in this channel")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .toJSON(),
];

export function getSlashCommandsForGuild(guildId: string) {
  if (isRefereeGuild(guildId)) {
    return refereeSlashCommandDefinitions;
  }

  const leagueId = leagueGuildId();
  const mediaId = mediaGuildId();

  if (guildId === leagueId) {
    return leagueSlashCommandDefinitions;
  }

  if (mediaId && guildId === mediaId) {
    return mediaGuildSlashCommandDefinitions;
  }

  return [];
}