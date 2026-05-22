import { randomUUID } from "node:crypto";

import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
  type ButtonInteraction,
  type ChatInputCommandInteraction,
  type Client,
  type GuildMember,
  type GuildTextBasedChannel,
} from "discord.js";

import { env } from "@/bot/config";
import { createBotSupabase } from "@/bot/stats-queries";
import { MEDIA_ART_JOB_CLAIM_PREFIX } from "@/lib/media-jobs/media-job-discord-constants";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const MAX_DESCRIPTION_LEN = 2000;
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

/** VF Media #art-jobs — override via DISCORD_MEDIA_JOBS_CHANNEL_ID on Railway. */
const DEFAULT_MEDIA_JOBS_CHANNEL_ID = "1507182649108725850";

export const mediaJobCommand = new SlashCommandBuilder()
  .setName("job")
  .setDescription(
    "Post an art brief for VF Media GFX (reporters → artists)",
  )
  .addStringOption((opt) =>
    opt
      .setName("description")
      .setDescription("What the art should be (report topic, style, deadline notes, etc.)")
      .setRequired(true)
      .setMaxLength(MAX_DESCRIPTION_LEN),
  )
  .addAttachmentOption((opt) =>
    opt
      .setName("reference")
      .setDescription("Reference image for the artist")
      .setRequired(true),
  )
  .toJSON();

type MediaArtJobRow = {
  id: string;
  guild_id: string;
  channel_id: string | null;
  message_id: string | null;
  posted_by_discord_id: string;
  posted_by_discord_tag: string | null;
  description: string;
  reference_image_url: string;
  status: "open" | "claimed" | "cancelled";
  claimed_by_discord_id: string | null;
  claimed_at: string | null;
  created_at: string;
};

function mediaJobsChannelId(): string {
  return (
    process.env.DISCORD_MEDIA_JOBS_CHANNEL_ID?.trim() ||
    DEFAULT_MEDIA_JOBS_CHANNEL_ID
  );
}

async function resolveSendableChannel(
  client: Client,
  channelId: string,
): Promise<GuildTextBasedChannel | null> {
  try {
    const ch = await client.channels.fetch(channelId);
    if (!ch?.isTextBased() || !ch.isSendable()) return null;
    return ch as GuildTextBasedChannel;
  } catch {
    return null;
  }
}

function memberHasAnyRole(member: GuildMember, roleIds: string[]): boolean {
  return roleIds.some((id) => id && member.roles.cache.has(id));
}

function canPostMediaJob(member: GuildMember): boolean {
  if (
    member.permissions.has(PermissionFlagsBits.ManageGuild) ||
    member.permissions.has(PermissionFlagsBits.ManageRoles)
  ) {
    return true;
  }
  return memberHasAnyRole(member, [
    env.DISCORD_MEDIA_REPORTER_ROLE_ID,
    env.DISCORD_MEDIA_STAFF_ROLE_ID,
  ]);
}

function canClaimMediaJob(member: GuildMember): boolean {
  return memberHasAnyRole(member, [
    env.DISCORD_MEDIA_GFX_ROLE_ID,
    env.DISCORD_MEDIA_STAFF_ROLE_ID,
  ]);
}

function buildOpenJobEmbed(
  row: Pick<
    MediaArtJobRow,
    "id" | "description" | "reference_image_url" | "posted_by_discord_id" | "posted_by_discord_tag"
  >,
): EmbedBuilder {
  const desc =
    row.description.length > 4000
      ? `${row.description.slice(0, 3997)}…`
      : row.description;

  return new EmbedBuilder()
    .setColor(0x6366f1)
    .setTitle("Art job · open")
    .setDescription(desc)
    .setImage(row.reference_image_url)
    .addFields({
      name: "Posted by",
      value: `<@${row.posted_by_discord_id}>`,
      inline: true,
    })
    .setFooter({
      text: `Job ${row.id.slice(0, 8)}… · GFX: click Claim job (one artist per post)`,
    })
    .setTimestamp(new Date());
}

function buildClaimJobButton(jobId: string): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`${MEDIA_ART_JOB_CLAIM_PREFIX}${jobId}`)
      .setLabel("Claim job")
      .setStyle(ButtonStyle.Success),
  );
}

function buildClaimedJobEmbed(
  row: MediaArtJobRow,
  claimedUserId: string,
): EmbedBuilder {
  const embed = buildOpenJobEmbed(row)
    .setColor(0x10b981)
    .setTitle("Art job · claimed")
    .addFields({
      name: "Claimed by",
      value: `<@${claimedUserId}>`,
      inline: true,
    });
  return embed;
}

export async function handleMediaJobCommand(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  if (!interaction.guild || !interaction.member) {
    await interaction.reply({
      flags: MessageFlags.Ephemeral,
      content: "Use `/job` inside the VF Media Discord server.",
    });
    return;
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  let member = interaction.member as GuildMember;
  try {
    member = await interaction.guild.members.fetch(interaction.user.id);
  } catch {
    /* keep cached member */
  }

  if (!canPostMediaJob(member)) {
    await interaction.editReply({
      content:
        "You need the **Reporter** or **Media staff** role to post art jobs. GFX artists claim jobs from the jobs channel.",
    });
    return;
  }

  const description = interaction.options.getString("description", true).trim();
  if (!description) {
    await interaction.editReply({
      content: "Add a short description of what the art should be.",
    });
    return;
  }

  const attachment = interaction.options.getAttachment("reference", true);
  if (!attachment.contentType?.startsWith("image/")) {
    await interaction.editReply({
      content: "The **reference** must be an image (PNG, JPG, WEBP, etc.).",
    });
    return;
  }
  if (attachment.size > MAX_IMAGE_BYTES) {
    await interaction.editReply({
      content: "Reference image is too large (max 8 MB).",
    });
    return;
  }

  const referenceUrl = attachment.url;
  const jobId = randomUUID();
  const supabase = createBotSupabase();

  const { error: insErr } = await supabase.from("media_art_jobs").insert({
    id: jobId,
    guild_id: interaction.guild.id,
    posted_by_discord_id: interaction.user.id,
    posted_by_discord_tag: interaction.user.tag,
    description,
    reference_image_url: referenceUrl,
    status: "open",
  });

  if (insErr) {
    console.error("[media-job] insert:", insErr);
    await interaction.editReply({
      content:
        "Could not create that job in the database. Ask staff to apply the latest migration.",
    });
    return;
  }

  const channel = await resolveSendableChannel(
    interaction.client,
    mediaJobsChannelId(),
  );
  if (!channel) {
    await supabase.from("media_art_jobs").delete().eq("id", jobId);
    await interaction.editReply({
      content:
        "Could not reach the art jobs channel. Check bot permissions and `DISCORD_MEDIA_JOBS_CHANNEL_ID`.",
    });
    return;
  }

  const row: MediaArtJobRow = {
    id: jobId,
    guild_id: interaction.guild.id,
    channel_id: null,
    message_id: null,
    posted_by_discord_id: interaction.user.id,
    posted_by_discord_tag: interaction.user.tag,
    description,
    reference_image_url: referenceUrl,
    status: "open",
    claimed_by_discord_id: null,
    claimed_at: null,
    created_at: new Date().toISOString(),
  };

  let msg;
  try {
    msg = await channel.send({
      content: `<@${interaction.user.id}> posted a new art job.`,
      embeds: [buildOpenJobEmbed(row)],
      components: [buildClaimJobButton(jobId)],
    });
  } catch (sendErr) {
    console.error("[media-job] channel send:", sendErr);
    await supabase.from("media_art_jobs").delete().eq("id", jobId);
    await interaction.editReply({
      content:
        "Could not post to the art jobs channel. Check bot **Send Messages** and **Embed Links** there.",
    });
    return;
  }

  await supabase
    .from("media_art_jobs")
    .update({
      channel_id: channel.id,
      message_id: msg.id,
    })
    .eq("id", jobId);

  await interaction.editReply({
    content: `Art job posted in ${channel}: ${msg.url}`,
  });
}

export async function handleMediaJobClaimButton(
  interaction: ButtonInteraction,
  jobIdRaw: string,
): Promise<void> {
  if (!interaction.guild || !interaction.member) {
    await interaction.reply({
      flags: MessageFlags.Ephemeral,
      content: "This button only works in the server.",
    });
    return;
  }

  const jobId = jobIdRaw.trim();
  if (!UUID_RE.test(jobId)) {
    await interaction.reply({
      flags: MessageFlags.Ephemeral,
      content: "Invalid job link.",
    });
    return;
  }

  let member = interaction.member as GuildMember;
  try {
    member = await interaction.guild.members.fetch(interaction.user.id);
  } catch {
    /* keep cached member */
  }

  if (!canClaimMediaJob(member)) {
    await interaction.reply({
      flags: MessageFlags.Ephemeral,
      content:
        "You need the **GFX / Media artist** role to claim art jobs. Reporters post jobs; artists claim them here.",
    });
    return;
  }

  const supabase = createBotSupabase();
  const { data: existing, error: fetchErr } = await supabase
    .from("media_art_jobs")
    .select("*")
    .eq("id", jobId)
    .maybeSingle();

  if (fetchErr || !existing) {
    await interaction.reply({
      flags: MessageFlags.Ephemeral,
      content: "That job could not be found.",
    });
    return;
  }

  const row = existing as MediaArtJobRow;

  if (row.status === "claimed") {
    const who = row.claimed_by_discord_id
      ? `<@${row.claimed_by_discord_id}>`
      : "another artist";
    await interaction.reply({
      flags: MessageFlags.Ephemeral,
      content: `This job was already claimed by ${who}.`,
    });
    return;
  }

  if (row.status !== "open") {
    await interaction.reply({
      flags: MessageFlags.Ephemeral,
      content: "This job is no longer available.",
    });
    return;
  }

  if (row.posted_by_discord_id === interaction.user.id) {
    await interaction.reply({
      flags: MessageFlags.Ephemeral,
      content: "You posted this job — wait for a GFX artist to claim it.",
    });
    return;
  }

  const claimedAt = new Date().toISOString();
  const { data: updated, error: updErr } = await supabase
    .from("media_art_jobs")
    .update({
      status: "claimed",
      claimed_by_discord_id: interaction.user.id,
      claimed_at: claimedAt,
    })
    .eq("id", jobId)
    .eq("status", "open")
    .select("*")
    .maybeSingle();

  if (updErr) {
    console.error("[media-job] claim update:", updErr);
    await interaction.reply({
      flags: MessageFlags.Ephemeral,
      content: "Could not claim that job right now. Try again.",
    });
    return;
  }

  if (!updated) {
    await interaction.reply({
      flags: MessageFlags.Ephemeral,
      content: "Someone else just claimed this job.",
    });
    return;
  }

  const claimedRow = updated as MediaArtJobRow;
  await interaction.deferUpdate();

  try {
    await interaction.message.edit({
      embeds: [buildClaimedJobEmbed(claimedRow, interaction.user.id)],
      components: [],
    });
  } catch (editErr) {
    console.error("[media-job] claim message edit:", editErr);
  }

  void (async () => {
    try {
      const reporter = await interaction.client.users.fetch(
        row.posted_by_discord_id,
      );
      await reporter.send({
        content: [
          `Your art job was claimed by **${interaction.user.tag}** (${interaction.user}).`,
          "",
          "**Brief:**",
          row.description.length > 1500
            ? `${row.description.slice(0, 1497)}…`
            : row.description,
          "",
          row.reference_image_url,
        ].join("\n"),
      });
    } catch {
      /* DMs closed */
    }
  })();

  try {
    await interaction.followUp({
      flags: MessageFlags.Ephemeral,
      content: `You claimed this job. Coordinate with <@${row.posted_by_discord_id}> to deliver the art.`,
    });
  } catch {
    /* interaction may not support followUp after deferUpdate in edge cases */
  }
}
