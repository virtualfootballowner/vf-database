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

export const refPostCommand = new SlashCommandBuilder()
  .setName("ref-post")
  .setDescription("Post a fixture for referees to claim (staff)")
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
  .addIntegerOption((opt) =>
    opt
      .setName("season")
      .setDescription("Season number")
      .setRequired(true)
      .setMinValue(1)
      .setMaxValue(20),
  )
  .addStringOption((opt) =>
    opt
      .setName("competition")
      .setDescription("Competition name (e.g. World Cup, EuroLeague)")
      .setRequired(true),
  )
  .addStringOption((opt) =>
    opt
      .setName("home")
      .setDescription("Home team name")
      .setRequired(true),
  )
  .addStringOption((opt) =>
    opt
      .setName("away")
      .setDescription("Away team name")
      .setRequired(true),
  )
  .addStringOption((opt) =>
    opt
      .setName("game_week")
      .setDescription("Game week label (optional)")
      .setRequired(false),
  )
  .addStringOption((opt) =>
    opt
      .setName("kickoff")
      .setDescription("Kickoff time label (optional)")
      .setRequired(false),
  )
  .addStringOption((opt) =>
    opt
      .setName("match_id")
      .setDescription("Optional matches.id to sync referee on claim")
      .setRequired(false),
  )
  .toJSON();

export const refMyGamesCommand = new SlashCommandBuilder()
  .setName("ref-my-games")
  .setDescription("Your claimed referee fixtures")
  .toJSON();

export const refUnclaimCommand = new SlashCommandBuilder()
  .setName("ref-unclaim")
  .setDescription("Release a claimed fixture before kickoff")
  .addStringOption((opt) =>
    opt
      .setName("assignment_id")
      .setDescription("Assignment UUID from the fixture embed footer")
      .setRequired(true),
  )
  .toJSON();

export const refereeSlashCommandDefinitions = [
  postVerifyRefCommand,
  refProfileCommand,
  refListCommand,
  refPostCommand,
  refMyGamesCommand,
  refUnclaimCommand,
];