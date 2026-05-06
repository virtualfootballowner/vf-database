import {
  MessageFlags,
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
} from "discord.js";

import {
  handleScrimmageCancel,
  handleScrimmageLeaderboard,
  handleScrimmageReportAfkStub,
  handleScrimmageStart,
  handleScrimmageStats,
  handleScrimmageVoid,
} from "@/bot/scrimmage/handlers";

/**
 * `/scrimmage` slash command — FACEIT-style pickup matches with ELO.
 *
 * Manual scoring (/scrimmage report, /scrimmage admin-result) is removed.
 * Final scores come from the Roblox event ingestion pipeline — when the
 * host runs `:fulltime` in-game, the API auto-tallies goal events,
 * applies ELO, and edits the lobby card to a result embed. The only
 * remaining admin action is `/scrimmage void` for stuck matches.
 */
export const scrimmageSlashCommand = new SlashCommandBuilder()
  .setName("scrimmage")
  .setDescription("FACEIT-style competitive scrimmages with ELO")
  .addSubcommand((sub) =>
    sub
      .setName("start")
      .setDescription("Open a new scrimmage lobby in the dedicated channel"),
  )
  .addSubcommand((sub) =>
    sub
      .setName("cancel")
      .setDescription("Cancel the active lobby (host only)"),
  )
  .addSubcommand((sub) =>
    sub
      .setName("report-afk")
      .setDescription("Open an AFK vote for a player in the live scrimmage")
      .addUserOption((opt) =>
        opt
          .setName("player")
          .setDescription("Player to report as AFK")
          .setRequired(true),
      ),
  )
  .addSubcommand((sub) =>
    sub
      .setName("stats")
      .setDescription("Show scrimmage ELO + W/L/D for yourself or another user")
      .addUserOption((opt) =>
        opt
          .setName("user")
          .setDescription("User to look up (defaults to you)")
          .setRequired(false),
      ),
  )
  .addSubcommand((sub) =>
    sub
      .setName("leaderboard")
      .setDescription("Top 10 scrimmage players by current ELO"),
  )
  .addSubcommand((sub) =>
    sub
      .setName("void")
      .setDescription("Void a stuck scrimmage (admin only — no ELO changes)")
      .addStringOption((opt) =>
        opt
          .setName("code")
          .setDescription("Match code, e.g. SCR-2026-0142")
          .setRequired(true)
          .setMaxLength(20),
      ),
  )
  .toJSON();

export async function handleScrimmageCommand(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  const sub = interaction.options.getSubcommand();
  switch (sub) {
    case "start":
      await handleScrimmageStart(interaction);
      return;
    case "cancel":
      await handleScrimmageCancel(interaction);
      return;
    case "report-afk":
      await handleScrimmageReportAfkStub(interaction);
      return;
    case "stats":
      await handleScrimmageStats(interaction);
      return;
    case "leaderboard":
      await handleScrimmageLeaderboard(interaction);
      return;
    case "void":
      await handleScrimmageVoid(interaction);
      return;
    default:
      await interaction.reply({
        flags: MessageFlags.Ephemeral,
        content: `Unknown scrimmage subcommand: ${sub}`,
      });
  }
}
