import type { AutocompleteInteraction } from "discord.js";

import { RESULT_PLAYER_AUTOCOMPLETE_FIELDS } from "@/bot/results/slots";
import {
  createBotSupabase,
  filterRegisteredPlayersForAutocomplete,
  truncateAutocompleteChoice,
} from "@/bot/stats-queries";

const PLAYER_FIELD_SET = new Set<string>(RESULT_PLAYER_AUTOCOMPLETE_FIELDS);

export async function handleResultsAutocomplete(
  interaction: AutocompleteInteraction,
): Promise<void> {
  const focused = interaction.options.getFocused(true);
  if (!PLAYER_FIELD_SET.has(focused.name)) {
    await interaction.respond([]);
    return;
  }

  try {
    const supabase = createBotSupabase();
    const token = String(focused.value).trim().toLowerCase();

    const players = await filterRegisteredPlayersForAutocomplete(
      supabase,
      token,
      [],
    );

    await interaction.respond(
      players.map((p) =>
        truncateAutocompleteChoice(p.roblox_username, p.roblox_username),
      ),
    );
  } catch {
    await interaction.respond([]);
  }
}
