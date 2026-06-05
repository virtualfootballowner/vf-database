import type { AutocompleteInteraction } from "discord.js";

import {
  autocompleteMultiValue,
  autocompleteQueryToken,
} from "@/bot/results/autocomplete-helpers";
import {
  createBotSupabase,
  filterRegisteredPlayersForAutocomplete,
  truncateAutocompleteChoice,
} from "@/bot/stats-queries";

const PLAYER_FIELDS = new Set([
  "scorers",
  "assists",
  "motm",
  "yellow_cards",
  "red_cards",
]);

export async function handleResultsAutocomplete(
  interaction: AutocompleteInteraction,
): Promise<void> {
  const focused = interaction.options.getFocused(true);
  if (!PLAYER_FIELDS.has(focused.name)) {
    await interaction.respond([]);
    return;
  }

  try {
    const supabase = createBotSupabase();
    const raw = String(focused.value);
    const isMulti = focused.name !== "motm";
    const { prefix, token, alreadyPicked } = isMulti
      ? autocompleteQueryToken(raw)
      : { prefix: "", token: raw.trim().toLowerCase(), alreadyPicked: [] as string[] };

    const players = await filterRegisteredPlayersForAutocomplete(
      supabase,
      token,
      alreadyPicked,
    );

    await interaction.respond(
      players.map((p) => {
        const value = isMulti
          ? autocompleteMultiValue(prefix, p.roblox_username)
          : p.roblox_username;
        return truncateAutocompleteChoice(p.roblox_username, value);
      }),
    );
  } catch {
    await interaction.respond([]);
  }
}
