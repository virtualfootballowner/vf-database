import {
  EmbedBuilder,
  MessageFlags,
  PermissionFlagsBits,
  type ChatInputCommandInteraction,
} from "discord.js";

import {
  discordKickoffTimestampRich,
  discordLogTimestamp,
  formatCaseNumber,
  formatPostponementStatus,
  renderDenialLog,
} from "@/bot/postpone/format";
import {
  fetchPostponementLog,
  isPostponementLogStatusFilter,
  type PostponementLogEntry,
} from "@/bot/postpone/queries";
import { buildTeamNameBySlug, createBotSupabase } from "@/bot/stats-queries";

/** One embed per message — Discord caps total embed chars at 6000 per message. */
const PAGE_CHAR_LIMIT = 3800;
const MAX_PAGES = 8;

function resolvedAt(entry: PostponementLogEntry): string | null {
  if (entry.staff_resolved_at) return entry.staff_resolved_at;
  if (
    entry.status === "accepted" ||
    entry.status === "denied" ||
    entry.status === "expired" ||
    entry.status === "superseded"
  ) {
    return entry.updated_at;
  }
  return null;
}

function formatLogEntry(
  entry: PostponementLogEntry,
  teamNames: Map<string, string>,
): string {
  const requester =
    teamNames.get(entry.requester_team_slug) ?? entry.requester_team_slug;
  const opponent =
    teamNames.get(entry.opponent_team_slug) ?? entry.opponent_team_slug;
  const season = entry.season != null ? `S${entry.season}` : "Season ?";
  const competition = entry.competition?.trim() || "Competition ?";

  const lines = [
    `### Case #${formatCaseNumber(Number(entry.case_number))} · ${formatPostponementStatus(entry.status)}`,
    `**${entry.home_name}** vs **${entry.away_name}** · ${season} · ${competition}`,
    `**${requester}** → **${opponent}**`,
    `Original ${discordKickoffTimestampRich(entry.original_scheduled_at)}`,
    `Proposed ${discordKickoffTimestampRich(entry.proposed_scheduled_at)}`,
    entry.staff_set_scheduled_at
      ? `Staff time ${discordKickoffTimestampRich(entry.staff_set_scheduled_at)}`
      : null,
    entry.reason.trim() ? `Reason: ${entry.reason.trim()}` : null,
    "",
    "**Timing**",
    `• Requested ${discordLogTimestamp(entry.created_at)}`,
    `• Opponent deadline ${discordLogTimestamp(entry.expires_at)}`,
    entry.status === "escalated" && entry.staff_ping_due_at
      ? `• Staff ping due ${discordLogTimestamp(entry.staff_ping_due_at)}`
      : null,
    entry.staff_last_ping_at
      ? `• Staff last pinged ${discordLogTimestamp(entry.staff_last_ping_at)}`
      : null,
    resolvedAt(entry)
      ? `• Resolved ${discordLogTimestamp(resolvedAt(entry))}`
      : null,
    entry.staff_discord_id
      ? `• Staff actor <@${entry.staff_discord_id}>`
      : null,
    `• Fixture denials **${entry.denial_count}**${entry.original_locked ? " · original locked" : ""}`,
  ];

  if (entry.denial_log.length > 0) {
    lines.push("", "**Denial log (fixture)**", renderDenialLog(entry.denial_log));
  }

  return lines.filter((line) => line !== null).join("\n");
}

function paginateBlocks(blocks: string[]): string[] {
  const pages: string[] = [];
  let chunk = "";

  for (const block of blocks) {
    const next = chunk ? `${chunk}\n\n---\n\n${block}` : block;
    if (next.length > PAGE_CHAR_LIMIT) {
      if (chunk.trim()) pages.push(chunk.trim());
      if (block.length > PAGE_CHAR_LIMIT) {
        pages.push(`${block.slice(0, PAGE_CHAR_LIMIT - 1)}…`);
        chunk = "";
      } else {
        chunk = block;
      }
    } else {
      chunk = next;
    }
  }

  if (chunk.trim()) pages.push(chunk.trim());
  return pages;
}

function buildPageEmbed(description: string, page: number, total: number): EmbedBuilder {
  const title =
    total === 1
      ? "Postponement request log"
      : `Postponement request log (${page}/${total})`;
  return new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle(title)
    .setDescription(description);
}

function formatErr(err: unknown): string {
  if (err instanceof Error && err.message.trim()) return err.message.trim();
  return "Unknown error";
}

export async function handlePostponeLogCommand(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  if (!interaction.guild) {
    await interaction.reply({
      flags: MessageFlags.Ephemeral,
      content: "Run this command inside the server.",
    });
    return;
  }

  if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageRoles)) {
    await interaction.reply({
      flags: MessageFlags.Ephemeral,
      content: "You need the **Manage Roles** permission to use `/postpone-log`.",
    });
    return;
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const statusRaw = interaction.options.getString("status");
  const status =
    statusRaw && isPostponementLogStatusFilter(statusRaw) ? statusRaw : null;
  const limit = interaction.options.getInteger("limit") ?? 25;

  try {
    const supabase = createBotSupabase();
    const entries = await fetchPostponementLog(supabase, { status, limit });
    const teamNames = await buildTeamNameBySlug(supabase);

    if (entries.length === 0) {
      const filterNote = status
        ? ` with status **${formatPostponementStatus(status)}**`
        : "";
      await interaction.editReply({
        content: `No postponement requests found for **upcoming fixtures**${filterNote}.`,
      });
      return;
    }

    const blocks = entries.map((entry) => formatLogEntry(entry, teamNames));
    let pages = paginateBlocks(blocks);
    const omittedPages = pages.length > MAX_PAGES;
    if (omittedPages) pages = pages.slice(0, MAX_PAGES);

    const filterNote = status
      ? ` · filter: ${formatPostponementStatus(status)}`
      : "";
    const footerNote =
      entries.length >= limit || omittedPages
        ? `\n\n_Showing newest **${entries.length}** upcoming-fixture request${entries.length === 1 ? "" : "s"}${filterNote}${omittedPages ? " · log truncated — lower \`limit\` or filter by \`status\`" : ""}._`
        : "";

    const embeds = pages.map((page, i) => {
      const embed = buildPageEmbed(page, i + 1, pages.length);
      if (i === pages.length - 1 && footerNote) {
        embed.setDescription(`${page}${footerNote}`);
      }
      return embed;
    });

    await interaction.editReply({ embeds: [embeds[0]!] });
    for (let i = 1; i < embeds.length; i++) {
      await interaction.followUp({
        flags: MessageFlags.Ephemeral,
        embeds: [embeds[i]!],
      });
    }
  } catch (err) {
    console.error("/postpone-log failed:", err);
    await interaction.editReply({
      content: `Could not load postponement log: ${formatErr(err)}`,
    });
  }
}
