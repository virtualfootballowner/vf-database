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
import {
  CONTRACT_ROLE_CHOICES,
  SPECIFIC_POSITION_CHOICES,
} from "@/lib/roster-positions";

/** Max players per club per season (signed squad); managers cannot /contract beyond this. */
export const MAX_ROSTER_PLAYERS = 18;

async function rosterSpaceForNewSignee(
  supabase: ReturnType<typeof createBotSupabase>,
  teamSlug: string,
  season: number,
  signeePlayerId: string,
): Promise<{ allowed: boolean; onRoster: boolean; filled: number; pendingNew: number }> {
  const { data: rosterRows, error: rErr } = await supabase
    .from("player_team_seasons")
    .select("player_id")
    .eq("team_slug", teamSlug)
    .eq("season", season);

  if (rErr) throw rErr;
  const rosterIds = new Set(
    (rosterRows ?? []).map((r: { player_id: string }) => r.player_id),
  );
  const onRoster = rosterIds.has(signeePlayerId);
  if (onRoster) {
    return {
      allowed: true,
      onRoster: true,
      filled: rosterIds.size,
      pendingNew: 0,
    };
  }

  const { data: pendingRows, error: pErr } = await supabase
    .from("contract_offers")
    .select("signee_player_id")
    .eq("team_slug", teamSlug)
    .eq("season", season)
    .in("status", ["pending", "accepted"]);

  if (pErr) throw pErr;

  let pendingNew = 0;
  for (const row of pendingRows ?? []) {
    const sid = (row as { signee_player_id: string }).signee_player_id;
    if (!rosterIds.has(sid)) pendingNew += 1;
  }

  const filled = rosterIds.size;
  const allowed = filled + pendingNew < MAX_ROSTER_PLAYERS;
  return { allowed, onRoster: false, filled, pendingNew };
}

export const CONTRACT_BTN_APPROVE = "vfl:con:a:";
export const CONTRACT_BTN_DENY = "vfl:con:d:";
export const CONTRACT_STAFF_APPROVE = "vfl:con:staff:a:";
export const CONTRACT_STAFF_DENY = "vfl:con:staff:d:";

/** @deprecated Use {@link SPECIFIC_POSITION_CHOICES} from `@/lib/roster-positions`. */
export const CONTRACT_POSITION_CHOICES = SPECIFIC_POSITION_CHOICES;

export { CONTRACT_ROLE_CHOICES, SPECIFIC_POSITION_CHOICES };

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type ContractOfferRow = {
  id: string;
  guild_id: string;
  channel_id: string | null;
  message_id: string | null;
  staff_review_channel_id: string | null;
  staff_review_message_id: string | null;
  contractor_discord_id: string;
  signee_discord_id: string;
  team_slug: string;
  season: number;
  roster_position: string;
  roster_role: string;
  signee_player_id: string;
  status: string;
};

function ensureStaffReview(interaction: ButtonInteraction): boolean {
  const hasPerm = interaction.memberPermissions?.has(
    PermissionFlagsBits.ManageRoles,
  );
  if (!hasPerm) {
    void interaction.reply({
      flags: MessageFlags.Ephemeral,
      content:
        "You need **Manage Roles** (staff) to approve or deny contract signings.",
    });
    return false;
  }
  return true;
}

function formatErr(err: unknown): string {
  if (err instanceof Error && err.message.trim()) return err.message.trim();
  return "Unknown error";
}

async function validateContractForRoster(
  supabase: ReturnType<typeof createBotSupabase>,
  offer: ContractOfferRow,
  activeSeason: number,
): Promise<
  | { ok: true; alreadyOnThisTeam: boolean }
  | { ok: false; code: "season_locked" | "other_team" | "roster_full" }
> {
  if (offer.season !== activeSeason) {
    return { ok: false, code: "season_locked" };
  }

  const existingTeams = await listPlayerRosterTeamsForSeason(
    supabase,
    offer.signee_player_id,
    activeSeason,
  );
  const otherTeam = existingTeams.find((t) => t !== offer.team_slug);
  if (otherTeam) {
    return { ok: false, code: "other_team" };
  }

  const alreadyOnThisTeam = existingTeams.includes(offer.team_slug);
  if (!alreadyOnThisTeam) {
    const { count, error: cntErr } = await supabase
      .from("player_team_seasons")
      .select("*", { count: "exact", head: true })
      .eq("team_slug", offer.team_slug)
      .eq("season", offer.season);
    if (cntErr) throw cntErr;
    if ((count ?? 0) >= MAX_ROSTER_PLAYERS) {
      return { ok: false, code: "roster_full" };
    }
  }

  return { ok: true, alreadyOnThisTeam };
}

async function applyContractToRoster(
  supabase: ReturnType<typeof createBotSupabase>,
  offer: ContractOfferRow,
  activeSeason: number,
): Promise<
  | { ok: true; alreadyOnThisTeam: boolean }
  | { ok: false; code: "season_locked" | "other_team" | "roster_full" | "db" }
> {
  const validation = await validateContractForRoster(
    supabase,
    offer,
    activeSeason,
  );
  if (!validation.ok) {
    return validation;
  }

  const { alreadyOnThisTeam } = validation;

  const { error: posErr } = await supabase
    .from("players")
    .update({ position: offer.roster_position })
    .eq("id", offer.signee_player_id);
  if (posErr) throw posErr;

  if (alreadyOnThisTeam) {
    const { error: ptsErr } = await supabase
      .from("player_team_seasons")
      .update({
        roster_position: offer.roster_position,
        roster_role: offer.roster_role,
      })
      .eq("player_id", offer.signee_player_id)
      .eq("team_slug", offer.team_slug)
      .eq("season", offer.season);
    if (ptsErr) throw ptsErr;
  } else {
    const { error: ptsErr } = await supabase.from("player_team_seasons").insert({
      player_id: offer.signee_player_id,
      team_slug: offer.team_slug,
      season: offer.season,
      games: 0,
      roster_position: offer.roster_position,
      roster_role: offer.roster_role,
    });
    if (ptsErr) throw ptsErr;
  }

  return { ok: true, alreadyOnThisTeam };
}

async function postContractStaffReviewCard(input: {
  guild: NonNullable<ChatInputCommandInteraction["guild"]>;
  offer: ContractOfferRow;
  teamLabel: string;
  teamUrl: string;
  logoUrl: string | null;
  robloxUsername: string;
}): Promise<{ ok: true; url: string } | { ok: false; detail: string }> {
  const channel = await input.guild.channels.fetch(
    env.DISCORD_STAFF_REVIEW_CHANNEL_ID,
  );
  if (!channel?.isTextBased() || !channel.isSendable()) {
    return { ok: false, detail: "Staff review channel missing or not writable." };
  }

  const embed = new EmbedBuilder()
    .setColor(0x083696)
    .setAuthor({
      name: `${input.teamLabel} · contract signing`,
      iconURL: input.logoUrl ?? undefined,
      url: input.teamUrl,
    })
    .setTitle("Contract signing — staff review")
    .setDescription(
      [
        "The **signee accepted** this contract. Roster changes happen only after staff approve.",
        "",
        "Use **Approve signing** to add them to the squad sheet, or **Deny** to reject.",
      ].join("\n\n"),
    )
    .addFields(
      {
        name: "Team",
        value: `[${input.teamLabel}](${input.teamUrl})\n\`${input.offer.team_slug}\` · **S${input.offer.season}**`,
        inline: false,
      },
      {
        name: "Player",
        value: `<@${input.offer.signee_discord_id}>\n\`${input.robloxUsername}\``,
        inline: true,
      },
      {
        name: "Manager",
        value: `<@${input.offer.contractor_discord_id}>`,
        inline: true,
      },
      {
        name: "Squad",
        value: `**${input.offer.roster_position}** · ${input.offer.roster_role}`,
        inline: false,
      },
    )
    .setThumbnail(input.logoUrl ?? null)
    .setFooter({
      text: `Offer ${input.offer.id.slice(0, 8)}… · Manage Roles to act`,
    })
    .setTimestamp(new Date());

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`${CONTRACT_STAFF_APPROVE}${input.offer.id}`)
      .setLabel("Approve signing")
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(`${CONTRACT_STAFF_DENY}${input.offer.id}`)
      .setLabel("Deny")
      .setStyle(ButtonStyle.Danger),
  );

  const msg = await channel.send({ embeds: [embed], components: [row] });
  return { ok: true, url: msg.url };
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

  const isSelfContract = signeeUser.id === interaction.user.id;

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

    const space = await rosterSpaceForNewSignee(
      supabase,
      teamRes.teamSlug,
      activeSeason,
      signeeProfile.id,
    );
    if (!space.allowed) {
      await interaction.editReply({
        content:
          `**${teamLabel}** can’t offer new contracts right now — **Season ${activeSeason}** is capped at **${MAX_ROSTER_PLAYERS}** players (${space.filled} signed + ${space.pendingNew} pending to players not yet on the squad). Wait for a deal to clear or ask staff to adjust the roster.`,
      });
      return;
    }

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
        isSelfContract
          ? `<@${signeeUser.id}> — **self-sign** as manager on the **Season ${activeSeason}** roster.\n\nUse **Approve** below to set your position & role (you’re already on the squad sheet from \`/appoint\` — this won’t duplicate you).\n\n_This offer **voids** if there is no response within **30 minutes**._`
          : `<@${signeeUser.id}> — you’ve been offered a spot on the **Season ${activeSeason}** roster.\n\nOnly **you** can use the buttons below. If you **Approve**, staff still review before you’re added to the squad.\n\n_This offer **voids** if there is no response within **30 minutes**._`,
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
        text: `Offer ${offerId.slice(0, 8)}… · Season ${activeSeason} · Void if no answer in 30 min`,
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
            "",
            "_This offer **voids automatically** if you don’t respond within **30 minutes**._",
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

  // Signee accept → staff review (no roster write yet)
  await interaction.deferUpdate();

  const guild = interaction.guild;
  if (!guild) {
    await interaction.editReply({
      content: "This must be used inside the server.",
      embeds: [],
      components: [],
    });
    return;
  }

  try {
    const precheck = await validateContractForRoster(
      supabase,
      offer,
      activeSeason,
    );

    if (!precheck.ok) {
      const teamNames = await teamNamesPromise;
      const logoUrl = await logoUrlPromise;
      const teamLabel = teamNames.get(offer.team_slug) ?? offer.team_slug;
      const teamUrl = `${siteBase}/teams/${encodeURIComponent(offer.team_slug)}?season=${offer.season}`;

      if (precheck.code === "season_locked") {
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

      if (precheck.code === "other_team") {
        const existingTeams = await listPlayerRosterTeamsForSeason(
          supabase,
          offer.signee_player_id,
          activeSeason,
        );
        const otherTeam = existingTeams.find((t) => t !== offer.team_slug)!;
        const otherLabel = teamNames.get(otherTeam) ?? otherTeam;
        const teamUrlOther = `${siteBase}/teams/${encodeURIComponent(otherTeam)}?season=${activeSeason}`;

        const embedBlock = new EmbedBuilder()
          .setColor(0xef4444)
          .setAuthor({ name: teamLabel, iconURL: logoUrl ?? undefined })
          .setTitle(`Already rostered — Season ${activeSeason}`)
          .setDescription(
            [
              `You’re already on **[${otherLabel}](${teamUrlOther})** (\`${otherTeam}\`).`,
              "Leave that roster (staff) before signing elsewhere.",
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

      if (precheck.code === "roster_full") {
        const embedFull = new EmbedBuilder()
          .setColor(0xef4444)
          .setAuthor({
            name: teamLabel,
            iconURL: logoUrl ?? undefined,
            url: teamUrl,
          })
          .setTitle("Roster full")
          .setDescription(
            [
              `**${teamLabel}** already has **${MAX_ROSTER_PLAYERS}** players for **Season ${offer.season}**.`,
              "Staff need to release someone before new signings.",
            ].join("\n\n"),
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

        await interaction.editReply({ embeds: [embedFull], components: [] });
        return;
      }
    }

    const { data: signeeRow } = await supabase
      .from("players")
      .select("roblox_username")
      .eq("id", offer.signee_player_id)
      .maybeSingle();
    const robloxUsername =
      (signeeRow as { roblox_username?: string } | null)?.roblox_username?.trim() ||
      offer.signee_discord_id;

    const teamNames = await teamNamesPromise;
    const logoUrl = await logoUrlPromise;
    const teamLabel = teamNames.get(offer.team_slug) ?? offer.team_slug;
    const teamUrl = `${siteBase}/teams/${encodeURIComponent(offer.team_slug)}?season=${offer.season}`;

    const staffCard = await postContractStaffReviewCard({
      guild,
      offer,
      teamLabel,
      teamUrl,
      logoUrl,
      robloxUsername,
    });
    if (!staffCard.ok) {
      await interaction.editReply({
        content: staffCard.detail,
        embeds: [],
        components: [],
      });
      return;
    }

    const acceptedAt = new Date().toISOString();
    const staffMsgMatch = staffCard.url.match(/\/channels\/\d+\/(\d+)\/(\d+)/);
    const staffChannelId = staffMsgMatch?.[1] ?? null;
    const staffMessageId = staffMsgMatch?.[2] ?? null;

    await supabase
      .from("contract_offers")
      .update({
        status: "accepted",
        accepted_at: acceptedAt,
        staff_review_channel_id: staffChannelId,
        staff_review_message_id: staffMessageId,
      })
      .eq("id", offerId);

    const embedPending = new EmbedBuilder()
      .setColor(0x6366f1)
      .setAuthor({
        name: teamLabel,
        iconURL: logoUrl ?? undefined,
        url: teamUrl,
      })
      .setTitle("Contract accepted — pending staff")
      .setDescription(
        `<@${offer.signee_discord_id}> **accepted**. Staff will review before you're added to the **Season ${offer.season}** roster.`,
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
          name: "Staff review",
          value: `[Open approval card](${staffCard.url})`,
          inline: false,
        },
      )
      .setThumbnail(logoUrl ?? null)
      .setFooter({ text: `Season ${offer.season} · Awaiting staff` })
      .setTimestamp(new Date());

    await interaction.editReply({ embeds: [embedPending], components: [] });
  } catch (err) {
    console.error("contract signee accept:", err);
    await interaction.editReply({
      content: `Could not send contract for staff review: ${formatErr(err)}`,
      embeds: [],
      components: [],
    });
  }
}

export async function handleContractStaffButton(
  interaction: ButtonInteraction,
  kind: "approve" | "deny",
  offerIdRaw: string,
): Promise<void> {
  if (!ensureStaffReview(interaction)) return;

  const offerId = offerIdRaw.trim();
  if (!UUID_RE.test(offerId)) {
    await interaction.reply({
      flags: MessageFlags.Ephemeral,
      content: "Invalid contract link.",
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
  const siteBase = env.VFL_SITE_URL.replace(/\/$/, "");

  const { data: row, error: fetchErr } = await supabase
    .from("contract_offers")
    .select("*")
    .eq("id", offerId)
    .maybeSingle();

  if (fetchErr || !row) {
    await interaction.reply({
      flags: MessageFlags.Ephemeral,
      content: "Could not load that contract.",
    });
    return;
  }

  const offer = row as ContractOfferRow;
  if (offer.guild_id !== guild.id) {
    await interaction.reply({
      flags: MessageFlags.Ephemeral,
      content: "This contract belongs to another server.",
    });
    return;
  }

  if (offer.status !== "accepted") {
    await interaction.reply({
      flags: MessageFlags.Ephemeral,
      content: "This signing was already resolved or is not awaiting staff.",
    });
    return;
  }

  await interaction.deferUpdate();
  const staffId = interaction.user.id;
  const resolvedAt = new Date().toISOString();
  const teamNames = await buildTeamNameBySlug(supabase);
  const teamLabel = teamNames.get(offer.team_slug) ?? offer.team_slug;
  const logoUrl = await fetchTeamLogoUrl(supabase, offer.team_slug, siteBase);
  const teamUrl = `${siteBase}/teams/${encodeURIComponent(offer.team_slug)}?season=${offer.season}`;

  if (kind === "deny") {
    await supabase
      .from("contract_offers")
      .update({
        status: "denied",
        staff_discord_id: staffId,
        resolved_at: resolvedAt,
      })
      .eq("id", offerId);

    const embed = EmbedBuilder.from(interaction.message.embeds[0] ?? {})
      .setColor(0x6b7280)
      .addFields({
        name: "Denied by staff",
        value: `${interaction.user} at <t:${Math.floor(Date.now() / 1000)}:F>`,
        inline: false,
      });

    await interaction.editReply({ embeds: [embed], components: [] });

    if (offer.channel_id && offer.message_id) {
      try {
        const ch = await guild.channels.fetch(offer.channel_id);
        if (ch?.isTextBased()) {
          const msg = await ch.messages.fetch(offer.message_id);
          const orig = msg.embeds[0];
          const updated = orig
            ? EmbedBuilder.from(orig)
            : new EmbedBuilder().setTitle("Contract");
          updated
            .setColor(0x6b7280)
            .setTitle("Contract denied by staff")
            .setDescription(
              `<@${offer.signee_discord_id}> accepted, but staff **denied** the signing.`,
            );
          await msg.edit({ embeds: [updated], components: [] });
        }
      } catch {
        /* original offer card may be gone */
      }
    }
    return;
  }

  try {
    const applied = await applyContractToRoster(supabase, offer, activeSeason);
    if (!applied.ok) {
      const reason =
        applied.code === "season_locked"
          ? `Season locked — only **S${activeSeason}** accepts signings.`
          : applied.code === "other_team"
            ? "Player is rostered on another team this season."
            : applied.code === "roster_full"
              ? `Roster is full (**${MAX_ROSTER_PLAYERS}** players).`
              : "Could not apply signing.";
      await interaction.followUp({
        flags: MessageFlags.Ephemeral,
        content: reason,
      });
      return;
    }

    await supabase
      .from("contract_offers")
      .update({
        status: "approved",
        staff_discord_id: staffId,
        resolved_at: resolvedAt,
      })
      .eq("id", offerId);

    const embed = EmbedBuilder.from(interaction.message.embeds[0] ?? {})
      .setColor(0x10b981)
      .addFields({
        name: "Approved",
        value: `${interaction.user} · added to **S${offer.season}** roster (${offer.roster_position} · ${offer.roster_role}).`,
        inline: false,
      });

    await interaction.editReply({ embeds: [embed], components: [] });

    if (offer.channel_id && offer.message_id) {
      try {
        const ch = await guild.channels.fetch(offer.channel_id);
        if (ch?.isTextBased()) {
          const msg = await ch.messages.fetch(offer.message_id);
          const embedOk = new EmbedBuilder()
            .setColor(0x10b981)
            .setAuthor({
              name: teamLabel,
              iconURL: logoUrl ?? undefined,
              url: teamUrl,
            })
            .setTitle("Contract signed")
            .setDescription(
              applied.alreadyOnThisTeam
                ? `<@${offer.signee_discord_id}> **signed** — roster slot updated on **Season ${offer.season}**.`
                : `<@${offer.signee_discord_id}> **signed** — added to **Season ${offer.season}** roster.`,
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
                name: "Approved by",
                value: `${interaction.user}`,
                inline: true,
              },
            )
            .setThumbnail(logoUrl ?? null)
            .setFooter({ text: `Season ${offer.season} · VF League` })
            .setTimestamp(new Date());

          await msg.edit({ embeds: [embedOk], components: [] });
        }
      } catch {
        /* original offer card may be gone */
      }
    }
  } catch (err) {
    console.error("contract staff approve:", err);
    await interaction.followUp({
      flags: MessageFlags.Ephemeral,
      content: `Could not complete signing: ${formatErr(err)}`,
    });
  }
}
