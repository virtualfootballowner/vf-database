import { randomUUID } from "node:crypto";

import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  MessageFlags,
  PermissionFlagsBits,
  type ButtonInteraction,
  type ChatInputCommandInteraction,
  type GuildMember,
  type GuildTextBasedChannel,
} from "discord.js";

import { env } from "@/bot/config";
import { fetchTeamLogoUrl } from "@/bot/site-assets";
import {
  buildTeamNameBySlug,
  createBotSupabase,
  findPlayerByDiscordId,
  listPlayerRosterTeamsForSeason,
  resolveManagerTeamSlugForSeason,
} from "@/bot/stats-queries";

export const RELEASE_BTN_APPROVE = "vfl:rel:a:";
export const RELEASE_BTN_DENY = "vfl:rel:d:";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type RosterReleaseRow = {
  id: string;
  guild_id: string;
  channel_id: string | null;
  message_id: string | null;
  requester_discord_id: string;
  target_discord_id: string;
  player_id: string;
  team_slug: string;
  season: number;
  reason: string | null;
  status: string;
  staff_discord_id: string | null;
};

function formatErr(err: unknown): string {
  if (err instanceof Error && err.message.trim()) return err.message.trim();
  return "Unknown error";
}

function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code?: string }).code === "23505"
  );
}

function ensureStaffReview(interaction: ButtonInteraction): boolean {
  const hasPerm = interaction.memberPermissions?.has(
    PermissionFlagsBits.ManageRoles,
  );
  if (!hasPerm) {
    void interaction.reply({
      flags: MessageFlags.Ephemeral,
      content:
        "You need **Manage Roles** (staff) to approve or deny roster releases.",
    });
    return false;
  }
  return true;
}

async function finalizeReleaseCard(
  interaction: ButtonInteraction,
  outcome: { verb: string; detail: string; color: number },
): Promise<void> {
  const original = interaction.message.embeds[0];
  const builder = original
    ? EmbedBuilder.from(original)
    : new EmbedBuilder().setTitle("Roster release");

  builder
    .setColor(outcome.color)
    .addFields({
      name: outcome.verb,
      value: outcome.detail,
      inline: false,
    })
    .setFooter({ text: `Resolved at ${new Date().toUTCString()}` });

  try {
    await interaction.editReply({
      embeds: [builder],
      components: [],
    });
  } catch (e) {
    console.error("Failed to update release review card:", e);
  }
}

export async function handleReleaseCommand(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  if (!interaction.guild || !interaction.member) {
    await interaction.reply({
      flags: MessageFlags.Ephemeral,
      content: "Use this command inside the server.",
    });
    return;
  }

  const activeSeason = env.VF_ACTIVE_ROSTER_SEASON;
  const member = interaction.member as GuildMember;
  if (!member.roles.cache.has(env.DISCORD_TEAM_MANAGER_ROLE_ID)) {
    await interaction.reply({
      flags: MessageFlags.Ephemeral,
      content: "You need the **club manager** role to request a player release.",
    });
    return;
  }

  const targetUser = interaction.options.getUser("player", true);
  const reasonRaw = interaction.options.getString("reason");
  const reason =
    reasonRaw?.trim().slice(0, 500) && reasonRaw.trim().length > 0
      ? reasonRaw.trim().slice(0, 500)
      : null;

  if (targetUser.bot) {
    await interaction.reply({
      flags: MessageFlags.Ephemeral,
      content: "Pick a real player, not a bot.",
    });
    return;
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  try {
    const supabase = createBotSupabase();
    const teamRes = await resolveManagerTeamSlugForSeason(
      supabase,
      interaction.user.id,
      activeSeason,
    );

    if (!teamRes.ok) {
      const msg =
        teamRes.reason === "no_player"
          ? "No VF **players** row is linked to your Discord account."
          : teamRes.reason === "no_username"
            ? "Your player record has no **Roblox username** on file."
            : teamRes.reason === "ambiguous"
              ? "You are listed as manager for **more than one** team this season. Ask staff to fix `team_season_managers`."
              : `You are not listed as a **team manager** for **S${activeSeason}** in the database. Ask staff to use \`/appoint\` if this is wrong.`;
      await interaction.editReply({ content: msg });
      return;
    }

    const targetProfile = await findPlayerByDiscordId(supabase, targetUser.id);
    if (!targetProfile) {
      await interaction.editReply({
        content: `${targetUser} has no VF profile linked to Discord.`,
      });
      return;
    }

    const teamsForPlayer = await listPlayerRosterTeamsForSeason(
      supabase,
      targetProfile.id,
      activeSeason,
    );
    if (!teamsForPlayer.includes(teamRes.teamSlug)) {
      await interaction.editReply({
        content: `${targetUser} is not on your **S${activeSeason}** roster (\`${teamRes.teamSlug}\`).`,
      });
      return;
    }

    const requestId = randomUUID();
    const { error: insErr } = await supabase
      .from("roster_release_requests")
      .insert({
        id: requestId,
        guild_id: interaction.guild.id,
        channel_id: null,
        message_id: null,
        requester_discord_id: interaction.user.id,
        target_discord_id: targetUser.id,
        player_id: targetProfile.id,
        team_slug: teamRes.teamSlug,
        season: activeSeason,
        reason,
        status: "pending",
      });

    if (insErr) {
      if (isUniqueViolation(insErr)) {
        await interaction.editReply({
          content:
            "A **pending release** for this player on your team is already in the staff queue.",
        });
        return;
      }
      console.error("roster_release_requests insert:", insErr);
      await interaction.editReply({
        content: `Could not create release request: ${formatErr(insErr)}. Is the database migration applied?`,
      });
      return;
    }

    const teamNames = await buildTeamNameBySlug(supabase);
    const teamLabel = teamNames.get(teamRes.teamSlug) ?? teamRes.teamSlug;
    const siteBase = env.VFL_SITE_URL.replace(/\/$/, "");
    const teamUrl = `${siteBase}/teams/${encodeURIComponent(teamRes.teamSlug)}?season=${activeSeason}`;
    const logoUrl = await fetchTeamLogoUrl(supabase, teamRes.teamSlug, siteBase);

    let channel: GuildTextBasedChannel;
    try {
      const fetched = await interaction.guild.channels.fetch(
        env.DISCORD_STAFF_REVIEW_CHANNEL_ID,
      );
      if (!fetched?.isTextBased() || !fetched.isSendable()) {
        await supabase.from("roster_release_requests").delete().eq("id", requestId);
        await interaction.editReply({
          content:
            "Request was recorded but the **staff review channel** is missing or not writable. Ask an admin to check `DISCORD_STAFF_REVIEW_CHANNEL_ID`. Your pending request was cancelled.",
        });
        return;
      }
      channel = fetched as GuildTextBasedChannel;
    } catch {
      await supabase.from("roster_release_requests").delete().eq("id", requestId);
      await interaction.editReply({
        content:
          "Could not reach the staff review channel. Check bot permissions and `DISCORD_STAFF_REVIEW_CHANNEL_ID`. Your pending request was cancelled.",
      });
      return;
    }

    const embed = new EmbedBuilder()
      .setColor(0xb45309)
      .setAuthor({
        name: `${teamLabel} · release request`,
        iconURL: logoUrl ?? undefined,
        url: teamUrl,
      })
      .setTitle("Roster release — staff review")
      .setDescription(
        [
          "A **club manager** asked to remove this player from the active-season squad sheet.",
          "Use **Approve release** to remove them from the roster, or **Deny** to leave the sheet unchanged.",
        ].join("\n\n"),
      )
      .addFields(
        {
          name: "Team",
          value: `[${teamLabel}](${teamUrl})\n\`${teamRes.teamSlug}\` · **S${activeSeason}**`,
          inline: false,
        },
        {
          name: "Player",
          value: `${targetUser}\n\`${targetProfile.roblox_username}\``,
          inline: true,
        },
        {
          name: "Requested by",
          value: `${interaction.user}`,
          inline: true,
        },
      )
      .setThumbnail(logoUrl ?? null);

    if (reason) {
      embed.addFields({
        name: "Reason",
        value: reason.length > 1000 ? `${reason.slice(0, 997)}…` : reason,
        inline: false,
      });
    }

    embed
      .setFooter({
        text: `Request ${requestId.slice(0, 8)}… · Manage Roles to act`,
      })
      .setTimestamp(new Date());

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`${RELEASE_BTN_APPROVE}${requestId}`)
        .setLabel("Approve release")
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(`${RELEASE_BTN_DENY}${requestId}`)
        .setLabel("Deny")
        .setStyle(ButtonStyle.Danger),
    );

    let msg;
    try {
      msg = await channel.send({
        embeds: [embed],
        components: [row],
      });
    } catch (sendErr) {
      console.error("release staff channel send:", sendErr);
      await supabase.from("roster_release_requests").delete().eq("id", requestId);
      await interaction.editReply({
        content:
          "Could not post to the staff review channel. Check bot **Send Messages** there. Your pending request was cancelled.",
      });
      return;
    }

    await supabase
      .from("roster_release_requests")
      .update({
        message_id: msg.id,
        channel_id: channel.id,
      })
      .eq("id", requestId);

    await interaction.editReply({
      content: `Sent to staff for approval: ${msg.url}`,
    });
  } catch (err) {
    console.error("/release failed:", err);
    await interaction.editReply({
      content: `Release request failed: ${formatErr(err)}`,
    });
  }
}

export async function handleReleaseStaffButton(
  interaction: ButtonInteraction,
  kind: "approve" | "deny",
  requestIdRaw: string,
): Promise<void> {
  if (!ensureStaffReview(interaction)) return;

  const requestId = requestIdRaw.trim();
  if (!UUID_RE.test(requestId)) {
    await interaction.reply({
      flags: MessageFlags.Ephemeral,
      content: "Invalid release request link.",
    });
    return;
  }

  const guild = interaction.guild;
  if (!guild) {
    await interaction.reply({
      flags: MessageFlags.Ephemeral,
      content: "Use this button inside the server.",
    });
    return;
  }

  const activeSeason = env.VF_ACTIVE_ROSTER_SEASON;
  const supabase = createBotSupabase();

  const { data: row, error: fetchErr } = await supabase
    .from("roster_release_requests")
    .select("*")
    .eq("id", requestId)
    .maybeSingle();

  if (fetchErr) {
    console.error("roster_release_requests fetch:", fetchErr);
    await interaction.reply({
      flags: MessageFlags.Ephemeral,
      content: "Could not load that release request.",
    });
    return;
  }

  const req = row as RosterReleaseRow | null;
  if (!req) {
    await interaction.reply({
      flags: MessageFlags.Ephemeral,
      content: "That release request no longer exists.",
    });
    return;
  }

  if (req.guild_id !== guild.id) {
    await interaction.reply({
      flags: MessageFlags.Ephemeral,
      content: "This request belongs to another server.",
    });
    return;
  }

  if (req.status !== "pending") {
    await interaction.reply({
      flags: MessageFlags.Ephemeral,
      content: "This request was already resolved.",
    });
    return;
  }

  await interaction.deferUpdate();

  const staffId = interaction.user.id;
  const resolvedAt = new Date().toISOString();

  if (kind === "deny") {
    await supabase
      .from("roster_release_requests")
      .update({
        status: "denied",
        staff_discord_id: staffId,
        resolved_at: resolvedAt,
      })
      .eq("id", requestId);

    await finalizeReleaseCard(interaction, {
      verb: "Denied",
      detail: `Roster unchanged. Decided by ${interaction.user}.`,
      color: 0x6b7280,
    });
    return;
  }

  // Approve
  if (req.season !== activeSeason) {
    await supabase
      .from("roster_release_requests")
      .update({
        status: "denied",
        staff_discord_id: staffId,
        resolved_at: resolvedAt,
      })
      .eq("id", requestId);

    await finalizeReleaseCard(interaction, {
      verb: "Not applied — season locked",
      detail: `This request was for **S${req.season}**, but only **S${activeSeason}** accepts roster changes now. Decided by ${interaction.user}.`,
      color: 0xf59e0b,
    });
    return;
  }

  try {
    const { data: removed, error: delErr } = await supabase
      .from("player_team_seasons")
      .delete()
      .eq("player_id", req.player_id)
      .eq("team_slug", req.team_slug)
      .eq("season", req.season)
      .select("player_id");

    if (delErr) throw delErr;

    const removedCount = removed?.length ?? 0;

    await supabase
      .from("roster_release_requests")
      .update({
        status: "approved",
        staff_discord_id: staffId,
        resolved_at: resolvedAt,
      })
      .eq("id", requestId);

    const detail =
      removedCount > 0
        ? `Removed from **S${req.season}** roster for \`${req.team_slug}\`. Approved by ${interaction.user}.`
        : `No matching roster row was found (player may already be off the sheet). Approved by ${interaction.user}.`;

    await finalizeReleaseCard(interaction, {
      verb: removedCount > 0 ? "Released" : "Approved (no row removed)",
      detail,
      color: removedCount > 0 ? 0x10b981 : 0xb0734f,
    });
  } catch (err) {
    console.error("release approve:", err);
    await interaction.editReply({
      content: `Could not update roster: ${formatErr(err)}`,
      embeds: interaction.message.embeds.length
        ? [EmbedBuilder.from(interaction.message.embeds[0]!)]
        : [],
      components: interaction.message.components,
    });
  }
}
