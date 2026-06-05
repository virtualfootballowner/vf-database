import {
  PermissionFlagsBits,
  SlashCommandBuilder,
  SlashCommandOptionsOnlyBuilder,
} from "discord.js";

function addPlayerSlots(
  builder: SlashCommandOptionsOnlyBuilder,
  prefix: string,
  count: number,
  label: string,
): SlashCommandOptionsOnlyBuilder {
  let b = builder;
  for (let i = 1; i <= count; i++) {
    b = b.addStringOption((opt) =>
      opt
        .setName(`${prefix}_${i}`)
        .setDescription(`${label} ${i} — pick from registered Roblox players`)
        .setRequired(false)
        .setAutocomplete(true),
    );
  }
  return b;
}

export function buildResultsSlashCommand() {
  let builder = new SlashCommandBuilder()
    .setName("results")
    .setDescription(
      "Log a fixture result (score, scorers, cards, MOTM) and post to #results",
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
    .addStringOption((opt) =>
      opt
        .setName("match_id")
        .setDescription("Fixture ID (e.g. S3-WC-G-B-02)")
        .setRequired(true),
    )
    .addStringOption((opt) =>
      opt
        .setName("scoreline")
        .setDescription("Final score — home first (e.g. 2-1)")
        .setRequired(true),
    );

  builder = addPlayerSlots(builder, "scorer", 8, "Scorer");
  builder = addPlayerSlots(builder, "assist", 5, "Assist");
  builder = builder.addStringOption((opt) =>
    opt
      .setName("motm")
      .setDescription("Man of the match — pick a registered Roblox username")
      .setRequired(false)
      .setAutocomplete(true),
  );
  builder = addPlayerSlots(builder, "yellow_card", 3, "Yellow card");
  builder = addPlayerSlots(builder, "red_card", 2, "Red card");

  return builder.toJSON();
}
