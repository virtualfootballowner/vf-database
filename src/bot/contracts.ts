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
} from "discord.js";

import { env } from "@/bot/config";
import { fetchTeamLogoUrl } from "@/bot/site-assets";
import {
  buildTeamNameBySlug,
  createBotSupabase,
  findPlayerByDiscordId,
  listPlayerRosterTeamsForSeason,
  loadTeams,
  resolveManagerTeamSlugForSeason,
  resolveTeamForSlashCommand,
} from "@/bot/stats-queries";

export const CONTRACT_BTN_APPROVE = "vfl:con:a:";
export const CONTRACT_BTN_DENY = "vfl:con:d:";

/** Slash-command choices (name shown in picker, value stored). */
export const CONTRACT_POSITION_CHOICES = [
  { name: "GK", value: "GK" },
  { name: "CB", value: "CB" },
  { name: "WB", value: "WB" },
  { name: "CDM", value: "CDM" },
  { name: "CM", value: "CM" },
  { name: "CAM", value: "CAM" },
  { name: "ST", value: "ST" },
  { name: "LW", value: "LW" },
  { name: "RW", value: "RW" },
] as const;

export const CONTRACT_ROLE_CHOICES = [
  { name: "Starter", value: "Starter" },
  { name: "Rotational", value: "Rotational" },
  { name: "Bench", value: "Bench" },
  { name: "Reserve", value: "Reserve" },
] as const;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type ContractOfferRow = {
  id: string;
  guild_id: string;
  channel_id: string | null;
  message_id: string | null;
  contractor_discord_id: string;
  signee_discord_id: string;
  team_slug: string;
  season: number;
  roster_position: string;
  roster_role: string;
  signee_player_id: string;
  status: string;
};

function formatErr(err: unknown): string {
  if (err instanceof Error && err.message.trim()) return err.message.trim();
  return "Unknown error";
}

export async function handleContractCommand(
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
  const roleId = env.DISCORD_TEAM_MANAGER_ROLE_ID;
  const hasManagerRole = member.roles.cache.has(roleId);

  if (!hasManagerRole) {
    await interaction.reply({
      flags: MessageFlags.Ephemeral,
      content:
        "You need the **club manager** role to offer contracts.",
    });
    return;
  }

  const teamRaw = interaction.options.getString("team", true);
  const signeeUser = interaction.options.getUser("player", true);
  const positionRaw = interaction.options.getString("position", true);
  const roleRaw = interaction.options.getString("role", true);

  if (signeeUser.bot) {
    await interaction.reply({
      flags: MessageFlags.Ephemeral,
      content: "Pick a real player, not a bot.",
    });
    return;
  }

  if (signeeUser.id === interaction.user.id) {
    await interaction.reply({
      flags: MessageFlags.Ephemeral,
      content: "You can’t offer yourself a contract.",
    });
    return;
  }

  await interaction.deferReply();

  try {
    const supabase = createBotSupabase();
    const teamRows = await loadTeams(supabase);
    const resolvedTeam = await resolveTeamForSlashCommand(
      supabase,
      teamRows,
      teamRaw,
    );
    if (!resolvedTeam) {
      await interaction.editReply({
        content:
          "Could not resolve that club. Use the **team** autocomplete or the exact slug.",
      });
      return;
    }
    const teamRes = { ok: true as const, teamSlug: resolvedTeam.slug };

    const canContractAnyTeam =
      interaction.guild.ownerId === interaction.user.id ||
      Boolean(
        interaction.memberPermissions?.has(PermissionFlagsBits.Administrator),
      );

    if (!canContractAnyTeam) {
      const managerTeam = await resolveManagerTeamSlugForSeason(
        supabase,
        interaction.user.id,
        activeSeason,
      );
      if (!managerTeam.ok) {
        const lines: Record<
          "no_player" | "no_username" | "not_manager" | "ambiguous",
          string
        > = {
          no_player:
            "Couldn’t find your VF profile. Verify on the website first — contracts are tied to your Discord link.",
          no_username:
            "Your VF profile has no Roblox username. Staff need to fix your **players** row before you can offer contracts.",
          not_manager:
            "You’re not listed as a **Season " +
            activeSeason +
            "** club manager in the database (`team_season_managers`), so you can’t offer contracts. Ask staff to assign your club, or use the correct team only if you’ve just been added.",
          ambiguous:
            "You’re listed as manager for **multiple clubs** this season in `team_season_managers`. Staff must fix that to one club before you can offer contracts.",
        };
        await interaction.editReply({
          content: lines[managerTeam.reason],
        });
        return;
      }
      if (managerTeam.teamSlug !== teamRes.teamSlug) {
        const teamNames = await buildTeamNameBySlug(supabase);
        const yours =
          teamNames.get(managerTeam.teamSlug) ?? managerTeam.teamSlug;
        await interaction.editReply({
          content:
            `You can only offer contracts for **your** club (**${yours}** · \`${managerTeam.teamSlug}\`), not \`${teamRes.teamSlug}\`. ` +
            "Pick your team in the \`team\` option. *Server admins can still offer for any club if needed.*",
        });
        return;
      }
    }

    const signeeProfile = await findPlayerByDiscordId(supabase, signeeUser.id);
    if (!signeeProfile) {
      await interaction.editReply({
        content:
          `${signeeUser} has no VF profile linked to Discord. They need a **players** row with their **discord_id** set.`,
      });
      return;
    }

    const offerId = randomUUID();
    const teamNames = await buildTeamNameBySlug(supabase);
    const teamLabel = teamNames.get(teamRes.teamSlug) ?? teamRes.teamSlug;
    const siteBase = env.VFL_SITE_URL.replace(/\/$/, "");
    const teamUrl = `${siteBase}/teams/${encodeURIComponent(teamRes.teamSlug)}?season=${activeSeason}`;
    const logoUrl = await fetchTeamLogoUrl(supabase, teamRes.teamSlug, siteBase);

    const { error: insErr } = await supabase.from("contract_offers").insert({
      id: offerId,
      guild_id: interaction.guild.id,
      channel_id: interaction.channelId ?? null,
      message_id: null,
      contractor_discord_id: interaction.user.id,
      signee_discord_id: signeeUser.id,
      team_slug: teamRes.teamSlug,
      season: activeSeason,
      roster_position: positionRaw,
      roster_role: roleRaw,
      signee_player_id: signeeProfile.id,
      status: "pending",
    });

    if (insErr) {
      console.error("contract_offers insert:", insErr);
      await interaction.editReply({
        content: `Could not create contract offer: ${formatErr(insErr)}. Is the database migration applied?`,
      });
      return;
    }

    const embed = new EmbedBuilder()
      .setColor(0x083696)
      .setAuthor({
        name: teamLabel,
        iconURL: logoUrl ?? undefined,
        url: teamUrl,
      })
      .setTitle("Contract offer")
      .setDescription(
        `<@${signeeUser.id}> — you’ve been offered a spot on the **Season ${activeSeason}** roster.\n\nOnly **you** can use the buttons below.`,
      )
      .addFields(
        {
          name: "Team",
          value: `[${teamLabel}](${teamUrl})\n\`${teamRes.teamSlug}\``,
          inline: false,
        },
        {
          name: "Signee",
          value: `${signeeUser}\n\`${signeeProfile.roblox_username}\``,
          inline: true,
        },
        {
          name: "Offered by",
          value: `${interaction.user}`,
          inline: true,
        },
        {
          name: "Position",
          value: `**${positionRaw}**`,
          inline: true,
        },
        {
          name: "Role",
          value: `**${roleRaw}**`,
          inline: true,
        },
      )
      .setThumbnail(logoUrl ?? null)
      .setFooter({
        text: `Offer ${offerId.slice(0, 8)}… · Season ${activeSeason}`,
      })
      .setTimestamp(new Date());

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`${CONTRACT_BTN_APPROVE}${offerId}`)
        .setLabel("Approve")
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(`${CONTRACT_BTN_DENY}${offerId}`)
        .setLabel("Deny")
        .setStyle(ButtonStyle.Danger),
    );

    await interaction.editReply({
      content: `<@${signeeUser.id}>`,
      embeds: [embed],
      components: [row],
    });

    const reply = await interaction.fetchReply();
    await supabase
      .from("contract_offers")
      .update({
        message_id: reply.id,
        channel_id: interaction.channelId ?? null,
      })
      .eq("id", offerId);

    /**
     * Solicited DM — heads-up to the signee with a deep link back to the
     * in-channel offer card (the only place the Approve / Deny buttons live).
     * Consent comes from the user having completed website verification; this
     * fits Discord's "no unsolicited DMs" rule. We swallow failures because
     * closed DMs aren't fatal — the @mention in-channel still pings them.
     */
    try {
      const dmEmbed = new EmbedBuilder()
        .setColor(0x083696)
        .setAuthor({
          name: `${teamLabel} · VF League`,
          iconURL: logoUrl ?? undefined,
          url: teamUrl,
        })
        .setTitle("📄 Contract offer")
        .setDescription(
          [
            `You’ve been offered a roster spot on **${teamLabel}** for **Season ${activeSeason}**.`,
            "",
            `> **Position** · **${positionRaw}**`,
            `> **Role** · **${roleRaw}**`,
            `> **Manager** · ${interaction.user}`,
            "",
            `**[Open the offer to approve or deny →](${reply.url})**`,
            "",
            "_Only you can use the buttons on the offer card._",
          ].join("\n"),
        )
        .setThumbnail(logoUrl ?? null)
        .setFooter({
          text: "VFL · You only get DMs from us about contracts and your registration.",
        })
        .setTimestamp(new Date());
      await signeeUser.send({ embeds: [dmEmbed] });
    } catch {
      // signee has DMs closed — the in-channel mention still notifies them
    }
  } catch (err) {
    console.error("/contract failed:", err);
    await interaction.editReply({
      content: `Contract command failed: ${formatErr(err)}`,
    });
  }
}

export async function handleContractButton(
  interaction: ButtonInteraction,
  kind: "approve" | "deny",
  offerIdRaw: string,
): Promise<void> {
  const offerId = offerIdRaw.trim();
  if (!UUID_RE.test(offerId)) {
    await interaction.reply({
      flags: MessageFlags.Ephemeral,
      content: "Invalid contract link.",
    });
    return;
  }

  const activeSeason = env.VF_ACTIVE_ROSTER_SEASON;
  const supabase = createBotSupabase();
  const siteBase = env.VFL_SITE_URL.replace(/\/$/, "");

  const { data: row, error: fetchErr } = await supabase
    .from("contract_offers")
    .select("*")
    .eq("id", offerId)
    .maybeSingle();

  if (fetchErr) {
    console.error("contract fetch:", fetchErr);
    await interaction.reply({
      flags: MessageFlags.Ephemeral,
      content: "Could not load that contract.",
    });
    return;
  }

  const offer = row as ContractOfferRow | null;
  if (!offer) {
    await interaction.reply({
      flags: MessageFlags.Ephemeral,
      content: "That contract offer no longer exists.",
    });
    return;
  }

  if (interaction.user.id !== offer.signee_discord_id) {
    await interaction.reply({
      flags: MessageFlags.Ephemeral,
      content: "Only the **signee** can approve or deny this contract.",
    });
    return;
  }

  if (offer.status !== "pending") {
    await interaction.reply({
      flags: MessageFlags.Ephemeral,
      content: "This contract was already resolved.",
    });
    return;
  }

  const teamNamesPromise = buildTeamNameBySlug(supabase);
  const logoUrlPromise = fetchTeamLogoUrl(supabase, offer.team_slug, siteBase);

  if (kind === "deny") {
    await interaction.deferUpdate();
    const teamLabel = (await teamNamesPromise).get(offer.team_slug) ?? offer.team_slug;
    const logoUrl = await logoUrlPromise;
    const teamUrl = `${siteBase}/teams/${encodeURIComponent(offer.team_slug)}?season=${offer.season}`;

    const embedDenied = new EmbedBuilder()
      .setColor(0x6b7280)
      .setAuthor({
        name: teamLabel,
        iconURL: logoUrl ?? undefined,
        url: teamUrl,
      })
      .setTitle("Contract denied")
      .setDescription(`<@${offer.signee_discord_id}> **declined** the offer.`)
      .addFields(
        {
          name: "Team",
          value: `[${teamLabel}](${teamUrl})\n\`${offer.team_slug}\``,
          inline: false,
        },
        {
          name: "Squad",
          value: `**${offer.roster_position}** · ${offer.roster_role}`,
          inline: false,
        },
      )
      .setThumbnail(logoUrl ?? null)
      .setFooter({ text: `Season ${offer.season}` })
      .setTimestamp(new Date());

    await supabase
      .from("contract_offers")
      .update({
        status: "denied",
        resolved_at: new Date().toISOString(),
      })
      .eq("id", offerId);

    await interaction.editReply({ embeds: [embedDenied], components: [] });
    return;
  }

  // Approve
  await interaction.deferUpdate();

  try {
    if (offer.season !== activeSeason) {
      const teamNames = await teamNamesPromise;
      const logoUrl = await logoUrlPromise;
      const teamLabel = teamNames.get(offer.team_slug) ?? offer.team_slug;
      const teamUrl = `${siteBase}/teams/${encodeURIComponent(offer.team_slug)}?season=${offer.season}`;

      const embedLocked = new EmbedBuilder()
        .setColor(0xf59e0b)
        .setAuthor({
          name: teamLabel,
          iconURL: logoUrl ?? undefined,
          url: teamUrl,
        })
        .setTitle("Roster locked for this season")
        .setDescription(
          [
            `This offer was for **Season ${offer.season}**, but only **Season ${activeSeason}** accepts signings now.`,
            "Past-season rosters can’t be changed via contracts.",
          ].join("\n\n"),
        )
        .setThumbnail(logoUrl ?? null)
        .setFooter({ text: `Offer season ${offer.season} · Active S${activeSeason}` })
        .setTimestamp(new Date());

      await supabase
        .from("contract_offers")
        .update({
          status: "denied",
          resolved_at: new Date().toISOString(),
        })
        .eq("id", offerId);

      await interaction.editReply({ embeds: [embedLocked], components: [] });
      return;
    }

    const existingTeams = await listPlayerRosterTeamsForSeason(
      supabase,
      offer.signee_player_id,
      activeSeason,
    );
    const otherTeam = existingTeams.find((t) => t !== offer.team_slug);
    if (otherTeam) {
      const teamNames = await teamNamesPromise;
      const logoUrl = await logoUrlPromise;
      const otherLabel = teamNames.get(otherTeam) ?? otherTeam;
      const teamLabel = teamNames.get(offer.team_slug) ?? offer.team_slug;
      const teamUrlOther = `${siteBase}/teams/${encodeURIComponent(otherTeam)}?season=${activeSeason}`;

      const embedBlock = new EmbedBuilder()
        .setColor(0xef4444)
        .setAuthor({
          name: teamLabel,
          iconURL: logoUrl ?? undefined,
        })
        .setTitle(`Already rostered — Season ${activeSeason}`)
        .setDescription(
          [
            `You’re already on **[${otherLabel}](${teamUrlOther})** (\`${otherTeam}\`).`,
            "Leave that roster (staff) before signing elsewhere.",
            "",
            `_This offer: \`${offer.team_slug}\`._`,
          ].join("\n"),
        )
        .setThumbnail(logoUrl ?? null)
        .setFooter({ text: `Season ${activeSeason}` })
        .setTimestamp(new Date());

      await supabase
        .from("contract_offers")
        .update({
          status: "denied",
          resolved_at: new Date().toISOString(),
        })
        .eq("id", offerId);

      await interaction.editReply({ embeds: [embedBlock], components: [] });
      return;
    }

    const { error: posErr } = await supabase
      .from("players")
      .update({ position: offer.roster_position })
      .eq("id", offer.signee_player_id);
    if (posErr) throw posErr;

    const { error: ptsErr } = await supabase.from("player_team_seasons").upsert(
      {
        player_id: offer.signee_player_id,
        team_slug: offer.team_slug,
        season: offer.season,
        games: 0,
        roster_position: offer.roster_position,
        roster_role: offer.roster_role,
      },
      { onConflict: "player_id,team_slug,season" },
    );

    if (ptsErr) throw ptsErr;

    await supabase
      .from("contract_offers")
      .update({
        status: "approved",
        resolved_at: new Date().toISOString(),
      })
      .eq("id", offerId);

    const teamNames = await teamNamesPromise;
    const logoUrl = await logoUrlPromise;
    const teamLabel = teamNames.get(offer.team_slug) ?? offer.team_slug;
    const teamUrl = `${siteBase}/teams/${encodeURIComponent(offer.team_slug)}?season=${offer.season}`;

    const embedOk = new EmbedBuilder()
      .setColor(0x10b981)
      .setAuthor({
        name: teamLabel,
        iconURL: logoUrl ?? undefined,
        url: teamUrl,
      })
      .setTitle("Contract signed")
      .setDescription(
        `<@${offer.signee_discord_id}> **accepted** — added to the **Season ${offer.season}** roster.`,
      )
      .addFields(
        {
          name: "Team",
          value: `[${teamLabel}](${teamUrl})\n\`${offer.team_slug}\``,
          inline: false,
        },
        {
          name: "Position",
          value: `**${offer.roster_position}**`,
          inline: true,
        },
        {
          name: "Role",
          value: `**${offer.roster_role}**`,
          inline: true,
        },
        {
          name: "Manager",
          value: `<@${offer.contractor_discord_id}>`,
          inline: true,
        },
      )
      .setThumbnail(logoUrl ?? null)
      .setFooter({ text: `Season ${offer.season} · VF League` })
      .setTimestamp(new Date());

    await interaction.editReply({ embeds: [embedOk], components: [] });
  } catch (err) {
    console.error("contract approve:", err);
    await interaction.editReply({
      content: `Could not complete signup: ${formatErr(err)}`,
      embeds: [],
      components: [],
    });
  }
}
