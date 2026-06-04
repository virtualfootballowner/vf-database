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

const EMBED_DESC_LIMIT = 3900;
const MAX_EMBEDS = 10;

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
    `### Case #${formatCaseNumber(entry.case_number)} · ${formatPostponementStatus(entry.status)}`,
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

function chunkLogEmbeds(blocks: string[]): EmbedBuilder[] {
  const embeds: EmbedBuilder[] = [];
  let chunk = "";
  let part = 1;

  const flush = () => {
    if (!chunk.trim()) return;
    embeds.push(
      new EmbedBuilder()
        .setColor(0x5865f2)
        .setTitle(
          embeds.length === 0
            ? "Postponement request log"
            : `Postponement log (continued ${part})`,
        )
        .setDescription(chunk.trim()),
    );
    part += 1;
    chunk = "";
  };

  for (const block of blocks) {
    const next = chunk ? `${chunk}\n\n---\n\n${block}` : block;
    if (next.length > EMBED_DESC_LIMIT) {
      flush();
      if (block.length > EMBED_DESC_LIMIT) {
        embeds.push(
          new EmbedBuilder()
            .setColor(0x5865f2)
            .setDescription(`${block.slice(0, EMBED_DESC_LIMIT - 3)}…`),
        );
        continue;
      }
      chunk = block;
    } else {
      chunk = next;
    }
  }
  flush();

  return embeds.slice(0, MAX_EMBEDS);
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
        content: `No postponement requests found${filterNote}.`,
      });
      return;
    }

    const blocks = entries.map((entry) => formatLogEntry(entry, teamNames));
    const embeds = chunkLogEmbeds(blocks);

    const filterNote = status
      ? ` · filter: ${formatPostponementStatus(status)}`
      : "";
    const truncated =
      entries.length >= limit
        ? `\n\n_Showing newest **${limit}** requests${filterNote}. Raise \`limit\` or filter by \`status\` to narrow._`
        : "";

    const last = embeds[embeds.length - 1];
    if (last && truncated) {
      const prev = last.data.description ?? "";
      last.setDescription(`${prev}${truncated}`);
    }

    await interaction.editReply({ embeds });
  } catch (err) {
    console.error("/postpone-log failed:", err);
    await interaction.editReply({
      content: "Could not load postponement log. Try again in a moment.",
    });
  }
}
