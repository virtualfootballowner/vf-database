import type { AutocompleteInteraction } from "discord.js";

import { env } from "@/bot/config";
import {
  createBotSupabase,
  listTeamRosterPlayerProfilesForSeason,
  loadTeams,
  resolveTeamForSlashCommand,
} from "@/bot/stats-queries";

export async function handleReleaseAutocomplete(
  interaction: AutocompleteInteraction,
): Promise<void> {
  const focused = interaction.options.getFocused(true);
  if (focused.name !== "roblox_username") return;

  const teamRaw = interaction.options.getString("team");
  if (!teamRaw?.trim()) {
    await interaction.respond([]);
    return;
  }

  try {
    const supabase = createBotSupabase();
    const teamRows = await loadTeams(supabase);
    const resolvedTeam = await resolveTeamForSlashCommand(
      supabase,
      teamRows,
      teamRaw,
    );
    if (!resolvedTeam) {
      await interaction.respond([]);
      return;
    }

    const q = String(focused.value).trim().toLowerCase();
    const roster = await listTeamRosterPlayerProfilesForSeason(
      supabase,
      resolvedTeam.slug,
      env.VF_ACTIVE_ROSTER_SEASON,
    );

    const matches = roster
      .filter((p) => {
        if (!q) return true;
        return p.roblox_username.toLowerCase().includes(q);
      })
      .slice(0, 25);

    await interaction.respond(
      matches.map((p) => ({
        name:
          p.roblox_username.length > 100
            ? `${p.roblox_username.slice(0, 97)}…`
            : p.roblox_username,
        value:
          p.roblox_username.length > 100
            ? p.roblox_username.slice(0, 100)
            : p.roblox_username,
      })),
    );
  } catch {
    await interaction.respond([]);
  }
}
