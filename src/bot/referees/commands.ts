import { PermissionFlagsBits, SlashCommandBuilder } from "discord.js";

export const postVerifyRefCommand = new SlashCommandBuilder()
  .setName("postverify-ref")
  .setDescription("Post the referee verify card in this channel (staff)")
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .toJSON();

export const refProfileCommand = new SlashCommandBuilder()
  .setName("ref-profile")
  .setDescription("Show your referee status and assignment count")
  .toJSON();

export const refListCommand = new SlashCommandBuilder()
  .setName("ref-list")
  .setDescription("List active referees (staff)")
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
  .toJSON();

export const refMyGamesCommand = new SlashCommandBuilder()
  .setName("ref-my-games")
  .setDescription("Your claimed referee fixtures")
  .toJSON();

export const refFixturesCommand = new SlashCommandBuilder()
  .setName("ref-fixtures")
  .setDescription("Post next matchday fixtures for refs to claim (staff)")
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
  .toJSON();

export const refereeSlashCommandDefinitions = [
  postVerifyRefCommand,
  refProfileCommand,
  refListCommand,
  refFixturesCommand,
  refMyGamesCommand,
];