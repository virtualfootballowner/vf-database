import { SlashCommandBuilder } from "discord.js";

export const mediaFixturesCommand = new SlashCommandBuilder()
  .setName("media-fixtures")
  .setDescription(
    "Post next matchday fixtures for streamers & commentators to claim (staff)",
  )
  .toJSON();

export const mediaMyGamesCommand = new SlashCommandBuilder()
  .setName("media-my-games")
  .setDescription("Your claimed streamer / commentator fixtures")
  .toJSON();

export const mediaSlashCommandDefinitions = [
  mediaFixturesCommand,
  mediaMyGamesCommand,
];
