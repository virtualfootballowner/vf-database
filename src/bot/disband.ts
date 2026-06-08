import {
  EmbedBuilder,
  MessageFlags,
  PermissionFlagsBits,
  type ChatInputCommandInteraction,
  type Guild,
} from "discord.js";
import type { SupabaseClient } from "@supabase/supabase-js";

import { env } from "@/bot/config";
import {
  clearTeamManagerCatalogColumns,
  createBotSupabase,
  loadTeams,
  resolveTeamForSlashCommand,
} from "@/bot/stats-queries";

function formatCommandError(err: unknown): string {
  if (err instanceof Error && err.message.trim()) return err.message.trim();
  return "Unknown error";
}

function staffMayRunAppointLikeCommand(
  interaction: ChatInputCommandInteraction,
): boolean {
  if (!interaction.guild) return false;
  if (interaction.guild.ownerId === interaction.user.id) return true;
  const perms = interaction.memberPermissions;
  return Boolean(
    perms?.has(PermissionFlagsBits.Administrator) ||
      perms?.has(PermissionFlagsBits.ManageGuild),
  );
}

export type DisbandTeamSeasonResult = {
  teamSlug: string;
  teamName: string;
  season: number;
  playersRemoved: number;
  hadManager: boolean;
  managerDisplayName: string | null;
  managerDiscordId: string | null;
  pendingContractsCancelled: number;
  pendingReleasesCancelled: number;
  catalogCleared: boolean;
  managerRoleRemoved: boolean;
};

export async function disbandTeamSeason(
  supabase: SupabaseClient,
  teamSlug: string,
  season: number,
): Promise<DisbandTeamSeasonResult> {
  const { data: managerRow } = await supabase
    .from("team_season_managers")
    .select("manager_display_name, manager_discord_id")
    .eq("team_slug", teamSlug)
    .eq("season", season)
    .maybeSingle();

  const managerDisplayName =
    (managerRow as { manager_display_name?: string | null } | null)
      ?.manager_display_name?.trim() || null;
  const managerDiscordId =
    (managerRow as { manager_discord_id?: string | null } | null)
      ?.manager_discord_id?.trim() || null;

  const { count: squadCount, error: squadCountErr } = await supabase
    .from("player_team_seasons")
    .select("player_id", { count: "exact", head: true })
    .eq("team_slug", teamSlug)
    .eq("season", season);
  if (squadCountErr) throw squadCountErr;

  const { error: squadDelErr } = await supabase
    .from("player_team_seasons")
    .delete()
    .eq("team_slug", teamSlug)
    .eq("season", season);
  if (squadDelErr) throw squadDelErr;

  const { error: managerDelErr } = await supabase
    .from("team_season_managers")
    .delete()
    .eq("team_slug", teamSlug)
    .eq("season", season);
  if (managerDelErr) throw managerDelErr;

  const catalog = await clearTeamManagerCatalogColumns(
    supabase,
    teamSlug,
    managerDiscordId,
  );

  const { count: contractsCancelled, error: contractErr } = await supabase
    .from("contract_offers")
    .delete({ count: "exact" })
    .eq("team_slug", teamSlug)
    .eq("season", season)
    .in("status", ["pending", "accepted"]);
  if (contractErr) throw contractErr;

  const { count: releasesCancelled, error: releaseErr } = await supabase
    .from("roster_release_requests")
    .delete({ count: "exact" })
    .eq("team_slug", teamSlug)
    .eq("season", season)
    .eq("status", "pending");
  if (releaseErr) throw releaseErr;

  return {
    teamSlug,
    teamName: teamSlug,
    season,
    playersRemoved: squadCount ?? 0,
    hadManager: Boolean(managerDisplayName || managerDiscordId),
    managerDisplayName,
    managerDiscordId,
    pendingContractsCancelled: contractsCancelled ?? 0,
    pendingReleasesCancelled: releasesCancelled ?? 0,
    catalogCleared: catalog.cleared,
    managerRoleRemoved: false,
  };
}

async function maybeStripManagerRole(
  guild: Guild,
  managerDiscordId: string | null,
  season: number,
  teamSlug: string,
): Promise<boolean> {
  if (!managerDiscordId?.trim()) return false;

  const supabase = createBotSupabase();
  const { count, error } = await supabase
    .from("team_season_managers")
    .select("team_slug", { count: "exact", head: true })
    .eq("season", season)
    .eq("manager_discord_id", managerDiscordId);
  if (error) {
    console.error("[disband] manager role check:", error);
    return false;
  }
  if ((count ?? 0) > 0) return false;

  try {
    const member = await guild.members.fetch(managerDiscordId);
    const roleId = env.DISCORD_TEAM_MANAGER_ROLE_ID;
    if (!member.roles.cache.has(roleId) || !member.manageable) return false;
    await member.roles.remove(
      roleId,
      `/disband ${teamSlug} S${season} — no remaining manager slots`,
    );
    return true;
  } catch (e) {
    console.error("[disband] manager role remove:", e);
    return false;
  }
}

export async function handleDisbandCommand(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  if (!interaction.guild) {
    await interaction.reply({
      flags: MessageFlags.Ephemeral,
      content: "Run this command inside the server.",
    });
    return;
  }

  if (!staffMayRunAppointLikeCommand(interaction)) {
    await interaction.reply({
      flags: MessageFlags.Ephemeral,
      content:
        "You need **Manage Server** (or **Administrator**), or be the **server owner**, to use `/disband`.",
    });
    return;
  }

  const teamRaw = interaction.options.getString("team", true);
  const season = interaction.options.getInteger("season", true);

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  try {
    const supabase = createBotSupabase();
    const teamRows = await loadTeams(supabase);
    const resolved = await resolveTeamForSlashCommand(supabase, teamRows, teamRaw);

    if (!resolved) {
      await interaction.editReply({
        content:
          "Could not resolve that team. Use **team** suggestions or the exact slug (e.g. `canada`).",
      });
      return;
    }

    const { data: teamMeta, error: metaErr } = await supabase
      .from("teams")
      .select("seasons")
      .eq("slug", resolved.slug)
      .maybeSingle();
    if (metaErr) throw metaErr;

    const seasonsOnFile = teamMeta?.seasons as number[] | null | undefined;
    if (
      Array.isArray(seasonsOnFile) &&
      seasonsOnFile.length > 0 &&
      !seasonsOnFile.includes(season)
    ) {
      const allowed = [...seasonsOnFile]
        .sort((a, b) => a - b)
        .map((s) => `**S${s}**`)
        .join(", ");
      await interaction.editReply({
        content: `**${resolved.name}** is only on file for ${allowed}. Pick one of those seasons.`,
      });
      return;
    }

    const result = await disbandTeamSeason(supabase, resolved.slug, season);
    result.teamName = resolved.name;

    if (
      result.playersRemoved === 0 &&
      !result.hadManager &&
      result.pendingContractsCancelled === 0 &&
      result.pendingReleasesCancelled === 0
    ) {
      await interaction.editReply({
        content: `**${resolved.name}** already has an empty **Season ${season}** roster and no manager on file.`,
      });
      return;
    }

    result.managerRoleRemoved = await maybeStripManagerRole(
      interaction.guild,
      result.managerDiscordId,
      season,
      resolved.slug,
    );

    const siteBase = env.VFL_SITE_URL.replace(/\/$/, "");
    const teamUrl = `${siteBase}/teams/${encodeURIComponent(resolved.slug)}?season=${season}`;

    const embed = new EmbedBuilder()
      .setColor(0xef4444)
      .setTitle("Team disbanded")
      .setDescription(
        [
          `**Team** · [${resolved.name}](${teamUrl})`,
          `**Season** · **${season}**`,
          "",
          `**Roster** · Removed **${result.playersRemoved}** player${result.playersRemoved === 1 ? "" : "s"} from \`player_team_seasons\`.`,
          result.hadManager
            ? `**Manager** · Cleared \`${result.managerDisplayName ?? "—"}\`${result.managerDiscordId ? ` (${result.managerDiscordId})` : ""}.`
            : "**Manager** · No manager was on file for this season.",
          result.catalogCleared
            ? "**Teams table** · `manager_discord_id` / `manager_roblox_id` cleared."
            : "**Teams table** · Left unchanged (another season manager still linked).",
          result.managerRoleRemoved
            ? `**Discord role** · Removed <@&${env.DISCORD_TEAM_MANAGER_ROLE_ID}> from the former manager.`
            : result.managerDiscordId
              ? "**Discord role** · Kept (they still manage another club this season, or role remove failed)."
              : "",
          result.pendingContractsCancelled > 0
            ? `**Contracts** · Cancelled **${result.pendingContractsCancelled}** pending/accepted offer${result.pendingContractsCancelled === 1 ? "" : "s"}.`
            : "",
          result.pendingReleasesCancelled > 0
            ? `**Releases** · Cancelled **${result.pendingReleasesCancelled}** pending release request${result.pendingReleasesCancelled === 1 ? "" : "s"}.`
            : "",
          "",
          "> Ready for **/appoint** with a new manager.",
        ]
          .filter(Boolean)
          .join("\n"),
      )
      .setFooter({ text: `By ${interaction.user.tag}` })
      .setTimestamp(new Date());

    await interaction.editReply({ embeds: [embed] });
  } catch (err) {
    console.error("/disband failed:", err);
    await interaction.editReply({
      content: `Could not disband team: ${formatCommandError(err)}`,
    });
  }
}
