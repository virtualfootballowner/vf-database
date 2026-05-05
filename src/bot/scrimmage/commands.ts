import {
  MessageFlags,
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
} from "discord.js";

import {
  handleScrimmageAdminResultStub,
  handleScrimmageCancelStub,
  handleScrimmageLeaderboard,
  handleScrimmageReportAfkStub,
  handleScrimmageReportStub,
  handleScrimmageStartStub,
  handleScrimmageStats,
  handleScrimmageVoidStub,
} from "@/bot/scrimmage/handlers";

/**
 * `/scrimmage` slash command — FACEIT-style pickup matches with ELO.
 *
 * One top-level command with subcommands so we don't pollute the global
 * command picker with eight `/scrimmage-*` entries. Subcommand-level
 * permissions aren't supported by Discord, so admin gating happens inside
 * each handler.
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
      .setDescription("Cancel the active lobby (host or admin only)"),
  )
  .addSubcommand((sub) =>
    sub
      .setName("report")
      .setDescription("Report the result of a live scrimmage you're captain of")
      .addStringOption((opt) =>
        opt
          .setName("score")
          .setDescription("Score as your-team\u2013their-team, e.g. \"4-2\"")
          .setRequired(true)
          .setMaxLength(11),
      ),
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
      .setName("admin-result")
      .setDescription("Override a scrimmage result (admin only)")
      .addStringOption((opt) =>
        opt
          .setName("match_code")
          .setDescription("Match code, e.g. SCR-2026-0142")
          .setRequired(true)
          .setMaxLength(20),
      )
      .addStringOption((opt) =>
        opt
          .setName("score")
          .setDescription("Final score as team1\u2013team2, e.g. \"4-2\"")
          .setRequired(true)
          .setMaxLength(11),
      ),
  )
  .addSubcommand((sub) =>
    sub
      .setName("void")
      .setDescription("Void a scrimmage (no ELO changes, marks cancelled)")
      .addStringOption((opt) =>
        opt
          .setName("match_code")
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
      await handleScrimmageStartStub(interaction);
      return;
    case "cancel":
      await handleScrimmageCancelStub(interaction);
      return;
    case "report":
      await handleScrimmageReportStub(interaction);
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
    case "admin-result":
      await handleScrimmageAdminResultStub(interaction);
      return;
    case "void":
      await handleScrimmageVoidStub(interaction);
      return;
    default:
      await interaction.reply({
        flags: MessageFlags.Ephemeral,
        content: `Unknown scrimmage subcommand: ${sub}`,
      });
  }
}
