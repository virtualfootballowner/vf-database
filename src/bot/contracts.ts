import { randomUUID } from "node:crypto";

import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  MessageFlags,
  type ButtonInteraction,
  type ChatInputCommandInteraction,
  type GuildMember,
} from "discord.js";

import { env } from "@/bot/config";
import {
  buildTeamNameBySlug,
  CONTRACT_ROSTER_SEASON,
  createBotSupabase,
  findPlayerByDiscordId,
  listPlayerRosterTeamsForSeason,
  resolveManagerTeamSlugForSeason,
} from "@/bot/stats-queries";

export const CONTRACT_BTN_APPROVE = "vfl:con:a:";
export const CONTRACT_BTN_DENY = "vfl:con:d:";

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

  const signeeUser = interaction.options.getUser("player", true);
  const positionRaw = interaction.options.getString("position", true).trim();
  const roleRaw = interaction.options.getString("role", true).trim();

  if (!positionRaw || positionRaw.length > 80) {
    await interaction.reply({
      flags: MessageFlags.Ephemeral,
      content: "Enter a **position** (max 80 characters).",
    });
    return;
  }
  if (!roleRaw || roleRaw.length > 80) {
    await interaction.reply({
      flags: MessageFlags.Ephemeral,
      content: "Enter a **role** (max 80 characters).",
    });
    return;
  }

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
    const teamRes = await resolveManagerTeamSlugForSeason(
      supabase,
      interaction.user.id,
      CONTRACT_ROSTER_SEASON,
    );

    if (!teamRes.ok) {
      const msg =
        teamRes.reason === "no_player"
          ? "No VF **players** row is linked to your Discord account."
          : teamRes.reason === "no_username"
            ? "Your player record has no **Roblox username** on file."
            : teamRes.reason === "ambiguous"
              ? "You are listed as manager for **more than one** team this season in the database. Ask staff to fix `team_season_managers`."
              : "You are not listed as a **team manager** for **S3** in the database (see `team_season_managers`). Ask staff to use `/appoint` if this is wrong.";
      await interaction.editReply({ content: msg });
      return;
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

    const { error: insErr } = await supabase.from("contract_offers").insert({
      id: offerId,
      guild_id: interaction.guild.id,
      channel_id: interaction.channelId ?? null,
      message_id: null,
      contractor_discord_id: interaction.user.id,
      signee_discord_id: signeeUser.id,
      team_slug: teamRes.teamSlug,
      season: CONTRACT_ROSTER_SEASON,
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

    const siteBase = env.VFL_SITE_URL.replace(/\/$/, "");
    const teamUrl = `${siteBase}/teams/${encodeURIComponent(teamRes.teamSlug)}?season=${CONTRACT_ROSTER_SEASON}`;

    const embed = new EmbedBuilder()
      .setColor(0x083696)
      .setTitle("Contract offer")
      .setDescription(
        [
          `<@${signeeUser.id}> — you’ve been offered a spot on the **S${CONTRACT_ROSTER_SEASON}** sheet.`,
          "",
          `**Team** · [${teamLabel}](${teamUrl}) (\`${teamRes.teamSlug}\`)`,
          `**Signee** · ${signeeUser} · \`${signeeProfile.roblox_username}\``,
          `**Offered by** · ${interaction.user}`,
          `**Position** · ${positionRaw}`,
          `**Role** · ${roleRaw}`,
          "",
          "Only **you** (the signee) can use the buttons below.",
        ].join("\n"),
      )
      .setFooter({ text: `Offer ID ${offerId.slice(0, 8)}… · VF League` })
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

  const supabase = createBotSupabase();

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

  if (kind === "deny") {
    await interaction.deferUpdate();
    const embedDenied = new EmbedBuilder()
      .setColor(0x6b7280)
      .setTitle("Contract denied")
      .setDescription(
        [
          `<@${offer.signee_discord_id}> **declined** the offer.`,
          `**Team** · \`${offer.team_slug}\``,
          `**Position** · ${offer.roster_position} · **Role** · ${offer.roster_role}`,
        ].join("\n"),
      )
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
    const existingTeams = await listPlayerRosterTeamsForSeason(
      supabase,
      offer.signee_player_id,
      CONTRACT_ROSTER_SEASON,
    );
    const otherTeam = existingTeams.find((t) => t !== offer.team_slug);
    if (otherTeam) {
      const teamNames = await buildTeamNameBySlug(supabase);
      const otherLabel = teamNames.get(otherTeam) ?? otherTeam;
      const embedBlock = new EmbedBuilder()
        .setColor(0xef4444)
        .setTitle("Cannot accept — already on an S3 roster")
        .setDescription(
          [
            `You’re already on the **Season ${CONTRACT_ROSTER_SEASON}** sheet for **${otherLabel}** (\`${otherTeam}\`).`,
            "Leave that roster (staff) before signing with another club.",
            "",
            `_Offer was for \`${offer.team_slug}\`._`,
          ].join("\n"),
        )
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

    const { error: posErr } = await supabase
      .from("players")
      .update({ position: offer.roster_position })
      .eq("id", offer.signee_player_id);
    if (posErr) console.warn("players.position update:", posErr);

    await supabase
      .from("contract_offers")
      .update({
        status: "approved",
        resolved_at: new Date().toISOString(),
      })
      .eq("id", offerId);

    const teamNames = await buildTeamNameBySlug(supabase);
    const teamLabel = teamNames.get(offer.team_slug) ?? offer.team_slug;

    const embedOk = new EmbedBuilder()
      .setColor(0x10b981)
      .setTitle("Contract signed")
      .setDescription(
        [
          `<@${offer.signee_discord_id}> **accepted** — added to **S${offer.season}** roster.`,
          `**Team** · ${teamLabel} (\`${offer.team_slug}\`)`,
          `**Position** · ${offer.roster_position}`,
          `**Role** · ${offer.roster_role}`,
          "",
          "Database: `player_team_seasons`",
        ].join("\n"),
      )
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
