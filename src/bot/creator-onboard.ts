import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonInteraction,
  ButtonStyle,
  EmbedBuilder,
  MessageFlags,
  ModalBuilder,
  PermissionFlagsBits,
  SlashCommandBuilder,
  TextInputBuilder,
  TextInputStyle,
  type ChatInputCommandInteraction,
  type GuildMember,
  type GuildTextBasedChannel,
  type ModalSubmitInteraction,
} from "discord.js";

import { env } from "@/bot/config";
import { createBotSupabase } from "@/bot/stats-queries";
import {
  listApprovedCreatorsForDirectory,
  parsePostedVideoLinks,
} from "@/lib/creator-onboard/approved-creators-directory";
import { COUNTRIES } from "@/lib/creator-onboard/countries";
import {
  CREATOR_POST_REMOVE_APPROVE_PREFIX,
  CREATOR_POST_REMOVE_REJECT_MODAL_PREFIX,
  CREATOR_POST_REMOVE_REJECT_PREFIX,
  CREATOR_REJECT_MODAL_PREFIX,
  CREATOR_REJECT_PREFIX,
  CREATOR_START_APP_BUTTON,
} from "@/lib/creator-onboard/creator-discord-constants";
import { loadCreatorWebEnv } from "@/lib/creator-onboard/env-web";
import { formatCreatorPlayPlatform } from "@/lib/creator-onboard/play-platform";
import {
  ROAD_TO_1M_TARGET_VIEWS,
  buildRoadTo1MChallenge,
  formatChallengeRobux,
  formatPoolSharePercent,
} from "@/lib/creator-onboard/road-to-1m";
import {
  socialProfileLabel,
  tiktokProfileHref,
  youtubeProfileHref,
} from "@/lib/creator-onboard/validators";

export const onboardMediaCommand = new SlashCommandBuilder()
  .setName("onboard-media")
  .setDescription(
    "Post the VF Create Program onboarding card in this channel",
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .toJSON();

export const creatorLeaderboardCommand = new SlashCommandBuilder()
  .setName("leaderboard")
  .setDescription("Show the Top 10 VF Create · Road to 1M leaderboard")
  .toJSON();

export const creatorProfileCommand = new SlashCommandBuilder()
  .setName("creator")
  .setDescription("Show a VF creator profile (defaults to you)")
  .addUserOption((opt) =>
    opt
      .setName("user")
      .setDescription("Discord member to look up")
      .setRequired(false),
  )
  .toJSON();

export const creatorPostedCommand = new SlashCommandBuilder()
  .setName("posted")
  .setDescription(
    "Add a competition post URL to your VF Create directory profile",
  )
  .addStringOption((opt) =>
    opt
      .setName("link")
      .setDescription("Full HTTPS URL (TikTok, YouTube, etc.)")
      .setRequired(true)
      .setMaxLength(2048),
  )
  .toJSON();

export const creatorPostRemoveCommand = new SlashCommandBuilder()
  .setName("post-remove")
  .setDescription(
    "Request staff approval to remove a directory post from your VF Create profile",
  )
  .addStringOption((opt) =>
    opt
      .setName("link")
      .setDescription("Exact HTTPS URL to remove (must already be on your profile)")
      .setRequired(true)
      .setMaxLength(2048),
  )
  .toJSON();

export const creatorRemoveFromDbCommand = new SlashCommandBuilder()
  .setName("creator-remove")
  .setDescription(
    "Delete all VF Create application data for a Discord user (staff only)",
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
  .addUserOption((opt) =>
    opt
      .setName("user")
      .setDescription("Discord member whose creator_applications rows to delete")
      .setRequired(true),
  )
  .toJSON();

const POST_REMOVE_URL_MARKER = "**Link to remove**";

function extractPostRemovalUrlFromEmbed(description: string | null | undefined): string | null {
  const d = description?.trim() ?? "";
  const i = d.indexOf(POST_REMOVE_URL_MARKER);
  if (i < 0) return null;
  const rest = d.slice(i + POST_REMOVE_URL_MARKER.length).trim();
  return rest.length > 0 ? rest : null;
}

const MAX_POSTED_URL_LEN = 2048;
const MAX_POSTED_LINKS_PER_CREATOR = 50;

function validatePostedHttpsUrl(raw: string): string | null {
  const t = raw.trim();
  if (!t || t.length > MAX_POSTED_URL_LEN) return null;
  let u: URL;
  try {
    u = new URL(t);
  } catch {
    return null;
  }
  if (u.protocol !== "https:" || !u.hostname) return null;
  return u.href;
}

function postedUrlsEffectivelyEqual(a: string, b: string): boolean {
  try {
    return new URL(a).href === new URL(b).href;
  } catch {
    return a === b;
  }
}

function vfGuildId(): string {
  return env.DISCORD_CREATOR_VF_GUILD_ID?.trim() || env.DISCORD_GUILD_ID;
}

/** VF Media #new-creator-checklist — override via DISCORD_CREATOR_CHECKLIST_CHANNEL_URL on Railway. */
const DEFAULT_CREATOR_CHECKLIST_CHANNEL_URL =
  "https://discord.com/channels/1500978557264986345/1502932833025527821";

/** VF Private Testing Hub — override via DISCORD_CREATOR_PRIVATE_TESTING_INVITE_URL. */
const DEFAULT_CREATOR_PRIVATE_TESTING_INVITE_URL =
  "https://discord.gg/F6UCX2xAHV";

function creatorApprovalDmContent(): string {
  const checklistUrl =
    env.DISCORD_CREATOR_CHECKLIST_CHANNEL_URL?.trim() ||
    DEFAULT_CREATOR_CHECKLIST_CHANNEL_URL;
  const privateTestingInvite =
    env.DISCORD_CREATOR_PRIVATE_TESTING_INVITE_URL?.trim() ||
    DEFAULT_CREATOR_PRIVATE_TESTING_INVITE_URL;
  const siteBase = env.VFL_SITE_URL.replace(/\/$/, "");
  const leaderboardUrl = `${siteBase}/content/creators#leaderboard`;
  // Discord doesn't render [label](url) masked links in plain message
  // content (only inside embeds), so use bare URLs here and let Discord
  // auto-link them. The Open Graph embed will preview the page below.
  return [
    "You're in. Welcome to **VF Create**.",
    `**VF Private Testing Hub** — join here for access: ${privateTestingInvite}`,
    `**Go straight to the leaderboard →** ${leaderboardUrl}`,
    `That's where your posts will show up once you run \`/posted\`. The full beginner guide and prize pool are on the same page.`,
    `Then jump into the checklist: ${checklistUrl}`,
  ].join("\n\n");
}

function creatorRejectionDmContent(reason: string | null): string {
  const detail = reason
    ? ["**Why:**", reason].join("\n")
    : [
        "No written reason was saved on this rejection.",
        "If you want feedback, reach out to staff in the VF Create server.",
      ].join(" ");

  return [
    "Thanks for applying to **VF Create**. We’re not able to accept your creator application at this time.",
    "",
    detail,
    "",
    "You’re welcome to apply again later if things change.",
  ].join("\n");
}

export async function handleOnboardMediaCommand(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  if (!interaction.guild) {
    await interaction.reply({
      ephemeral: true,
      content: "Use this command inside a server text channel.",
    });
    return;
  }

  const channel = interaction.channel;
  if (!channel?.isTextBased() || !("guild" in channel)) {
    await interaction.reply({
      ephemeral: true,
      content: "Use this command inside a server text channel.",
    });
    return;
  }

  const guildChannel = channel as GuildTextBasedChannel;
  const me = interaction.guild.members.me;
  const perms = me ? guildChannel.permissionsFor(me) : null;
  const required = [
    { flag: PermissionFlagsBits.ViewChannel, label: "View Channel" },
    { flag: PermissionFlagsBits.SendMessages, label: "Send Messages" },
    { flag: PermissionFlagsBits.EmbedLinks, label: "Embed Links" },
  ];
  const missing = required
    .filter((r) => !perms?.has(r.flag))
    .map((r) => r.label);

  if (missing.length > 0) {
    await interaction.reply({
      ephemeral: true,
      content: [
        `I can’t post here — I’m missing **${missing.join(", ")}** in <#${guildChannel.id}>.`,
        "Open the channel’s settings → Permissions → add the **VF Control** bot (or its role) and grant those permissions, then run `/onboard-media` again.",
      ].join("\n"),
    });
    return;
  }

  const embed = new EmbedBuilder()
    .setColor(0xea580c)
    .setTitle("VF Create Program — Now onboarding")
    .setDescription(
      [
        "Want early access to **VF**, **50,000 Robux** on the line, and a **Custom VF Brand Sponsorship**?",
        "",
        "Click **Start application** — we’ll **DM you** a personal link (about **3 minutes** on your phone). If DMs are closed, you’ll get the link here instead.",
      ].join("\n"),
    )
    .setFooter({ text: "VF Create Program" })
    .setTimestamp(new Date());

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(CREATOR_START_APP_BUTTON)
      .setLabel("Start application")
      .setStyle(ButtonStyle.Primary),
  );

  await interaction.deferReply({ ephemeral: true });

  try {
    await guildChannel.send({ embeds: [embed], components: [row] });
    await interaction.editReply({ content: "Posted the creator card." });
  } catch (e) {
    const err = e as { code?: number; message?: string };
    console.error("[creator] onboard-media send failed:", err);
    const code = err?.code === 50001 ? " (Missing Access)" : "";
    await interaction.editReply({
      content: [
        `Couldn’t post the card${code}. Discord said: \`${err?.message ?? "unknown error"}\`.`,
        "Make sure the **VF Control** bot has **View Channel**, **Send Messages**, and **Embed Links** in this channel.",
      ].join("\n"),
    });
  }
}

export async function handleStartCreatorAppButton(
  interaction: ButtonInteraction,
): Promise<void> {
  const siteBase = env.VFL_SITE_URL.replace(/\/$/, "");
  const url = `${siteBase}/content/creators/onboard?discord_id=${interaction.user.id}`;

  try {
    await interaction.user.send({
      content: [
        "**VF Create Program** — your personal link (only valid for your Discord account):",
        url,
      ].join("\n\n"),
    });
    await interaction.reply({
      ephemeral: true,
      content:
        "Check your **DMs** for your onboarding link. If nothing appears, enable DMs from this server’s members and try again.",
    });
  } catch {
    await interaction.reply({
      ephemeral: true,
      content: `Couldn’t DM you. Open this link to continue:\n${url}`,
    });
  }
}

function ensureManageRoles(interaction: ButtonInteraction): boolean {
  const ok = interaction.memberPermissions?.has(
    PermissionFlagsBits.ManageRoles,
  );
  if (!ok) {
    interaction
      .reply({
        ephemeral: true,
        content: "You need **Manage Roles** to review creator applications.",
      })
      .catch(() => undefined);
    return false;
  }
  return true;
}

export async function handleCreatorApproveButton(
  interaction: ButtonInteraction,
  appId: string,
): Promise<void> {
  if (!ensureManageRoles(interaction)) return;

  await interaction.deferUpdate();

  const supabase = createBotSupabase();
  const adminId = interaction.user.id;
  const now = new Date().toISOString();

  const { data: row, error: fetchErr } = await supabase
    .from("creator_applications")
    .select("*")
    .eq("id", appId)
    .maybeSingle();

  if (fetchErr || !row) {
    await interaction.editReply({
      content: "Application not found.",
      embeds: [],
      components: [],
    });
    return;
  }

  const rec = row as Record<string, unknown>;
  if (String(rec.status) !== "pending") {
    await interaction.followUp({
      ephemeral: true,
      content: "This application is no longer pending.",
    });
    return;
  }

  const discordId = String(rec.discord_id ?? "");
  const robloxId = String(rec.roblox_id ?? "").trim();

  // Enforce one approved row per Discord / Roblox: retire older approvals before this one lands.
  const supersedePayload = {
    status: "rejected" as const,
    rejection_reason: "Superseded by a newer creator application.",
    approved_by: adminId,
    approved_at: now,
    updated_at: now,
  };

  if (discordId) {
    const { error: e1 } = await supabase
      .from("creator_applications")
      .update(supersedePayload)
      .eq("status", "approved")
      .eq("discord_id", discordId)
      .neq("id", appId);
    if (e1) console.error("[creator] supersede discord:", e1);
  }
  if (robloxId) {
    const { error: e2 } = await supabase
      .from("creator_applications")
      .update(supersedePayload)
      .eq("status", "approved")
      .eq("roblox_id", robloxId)
      .neq("id", appId);
    if (e2) console.error("[creator] supersede roblox:", e2);
  }

  const { error: updErr } = await supabase
    .from("creator_applications")
    .update({
      status: "approved",
      approved_by: adminId,
      approved_at: now,
      updated_at: now,
    })
    .eq("id", appId);

  if (updErr) {
    console.error("[creator] approve update:", updErr);
    await interaction.editReply({
      content: "Database error approving.",
      embeds: interaction.message.embeds,
      components: [],
    });
    return;
  }

  const guildId = vfGuildId();
  const scoutRole = env.DISCORD_SCOUT_ROLE_ID;
  let memberNote = "";

  if (scoutRole) {
    try {
      const guild = await interaction.client.guilds.fetch(guildId);
      let member: GuildMember | null = null;
      try {
        member = await guild.members.fetch(discordId);
      } catch {
        member = null;
      }

      if (member) {
        try {
          await member.roles.add(
            scoutRole,
            `Creator approved by ${interaction.user.tag}`,
          ).catch((e) => console.error("[creator] role add:", e));
        } catch (e) {
          console.error("[creator] role add:", e);
        }
        // Nickname is left alone here — every member self-verifies through
        // `/verify-media` (or the league `/verify` flow) which already sets
        // their nickname to their Roblox username. Approval only adds the
        // Creator role on top of an already-verified member.
      } else {
        memberNote =
          " User is not in the VF server yet — role/nickname skipped until they join.";
      }
    } catch (e) {
      console.error("[creator] guild member:", e);
      memberNote = " Could not fetch VF guild member.";
    }
  }

  try {
    const u = await interaction.client.users.fetch(discordId);
    await u.send({
      content: creatorApprovalDmContent(),
    });
  } catch {
    /* DMs closed */
  }

  const original = interaction.message.embeds[0];
  const builder = original
    ? EmbedBuilder.from(original)
    : new EmbedBuilder().setTitle("Creator application");

  builder.setColor(0x10b981).addFields({
    name: "Approved",
    value: `By <@${adminId}> at <t:${Math.floor(Date.now() / 1000)}:F>${memberNote}`,
    inline: false,
  });

  await interaction.editReply({
    embeds: [builder],
    components: [],
  });
}

export async function handleCreatorRejectButton(
  interaction: ButtonInteraction,
  appId: string,
): Promise<void> {
  if (!ensureManageRoles(interaction)) return;

  const msgId = interaction.message.id;
  const modal = new ModalBuilder()
    .setCustomId(`${CREATOR_REJECT_MODAL_PREFIX}${appId}|${msgId}`)
    .setTitle("Reject application");

  const input = new TextInputBuilder()
    .setCustomId("rejection_reason")
    .setLabel("Reason (shown to applicant)")
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(false)
    .setMaxLength(500);

  modal.addComponents(
    new ActionRowBuilder<TextInputBuilder>().addComponents(input),
  );

  await interaction.showModal(modal);
}

export async function handleCreatorRejectModal(
  interaction: ModalSubmitInteraction,
): Promise<void> {
  const raw = interaction.customId.slice(CREATOR_REJECT_MODAL_PREFIX.length);
  const pipe = raw.indexOf("|");
  if (pipe <= 0) {
    await interaction.reply({
      ephemeral: true,
      content: "Invalid modal.",
    });
    return;
  }
  const appId = raw.slice(0, pipe);
  const messageId = raw.slice(pipe + 1);

  await interaction.deferReply({ ephemeral: true });

  const reason =
    interaction.fields.getTextInputValue("rejection_reason")?.trim() ||
    null;
  const adminId = interaction.user.id;
  const now = new Date().toISOString();

  const supabase = createBotSupabase();
  const { data: row, error: fetchErr } = await supabase
    .from("creator_applications")
    .select("*")
    .eq("id", appId)
    .maybeSingle();

  if (fetchErr || !row) {
    await interaction.editReply({
      content: "Application not found.",
    });
    return;
  }

  const rec = row as Record<string, unknown>;
  if (String(rec.status) !== "pending") {
    await interaction.editReply({
      content: "This application is no longer pending.",
    });
    return;
  }

  const discordId = String(rec.discord_id ?? "");

  const { error: updErr } = await supabase
    .from("creator_applications")
    .update({
      status: "rejected",
      approved_by: adminId,
      approved_at: now,
      rejection_reason: reason,
      updated_at: now,
    })
    .eq("id", appId);

  if (updErr) {
    console.error("[creator] reject:", updErr);
    await interaction.editReply({
      content: "Database error.",
    });
    return;
  }

  try {
    const u = await interaction.client.users.fetch(discordId);
    await u.send({
      content: creatorRejectionDmContent(reason),
    });
  } catch {
    /* ignore */
  }

  const channelId = interaction.channelId;
  if (channelId) {
    try {
      const ch = await interaction.client.channels.fetch(channelId);
      if (ch?.isTextBased()) {
        const msg = await ch.messages.fetch(messageId);
        if (msg.embeds[0]) {
          const builder = EmbedBuilder.from(msg.embeds[0]!);
          builder.setColor(0xef4444).addFields({
            name: "Rejected",
            value: `By <@${adminId}>${reason ? `\n> ${reason}` : ""}`,
            inline: false,
          });
          await msg.edit({
            embeds: [builder],
            components: [],
          });
        }
      }
    } catch (e) {
      console.error("[creator] reject message edit:", e);
    }
  }

  await interaction.editReply({
    content: "Rejected. Applicant was sent a DM with the details (if DMs are open).",
  });
}

type CreatorRow = {
  id: string;
  discord_id: string;
  discord_username: string | null;
  discord_avatar_url: string | null;
  roblox_id: string | null;
  roblox_username: string | null;
  roblox_avatar_url: string | null;
  tiktok_handle: string | null;
  youtube_handle: string | null;
  age: number | null;
  country: string | null;
  play_platform: string | null;
  status: "draft" | "pending" | "approved" | "rejected";
  approved_by: string | null;
  approved_at: string | null;
  rejection_reason: string | null;
  posted_video_links: unknown;
  created_at: string;
  updated_at: string;
};

const STATUS_META: Record<
  CreatorRow["status"],
  { label: string; color: number; line: string }
> = {
  draft: {
    label: "Draft",
    color: 0x6b7280,
    line: "Application started — not yet submitted.",
  },
  pending: {
    label: "Pending review",
    color: 0xf59e0b,
    line: "Application submitted — awaiting staff review.",
  },
  approved: {
    label: "Approved creator",
    color: 0x10b981,
    line: "Approved member of the VF Create Program.",
  },
  rejected: {
    label: "Rejected",
    color: 0xef4444,
    line: "Application was not approved.",
  },
};

function countryName(code: string | null): string | null {
  if (!code) return null;
  const hit = COUNTRIES.find((c) => c.code === code.toUpperCase());
  return hit?.name ?? code;
}

function formatViewsCompact(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return "0";
  if (n < 1000) return String(Math.round(n));
  if (n < 1_000_000) return `${(n / 1000).toFixed(n >= 10_000 ? 0 : 1)}K`;
  if (n < 1_000_000_000) {
    return `${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1)}M`;
  }
  return `${(n / 1_000_000_000).toFixed(1)}B`;
}

const LEADERBOARD_RANK_EMOJI: Record<number, string> = {
  1: "🥇",
  2: "🥈",
  3: "🥉",
};

export async function handleCreatorLeaderboardCommand(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  await interaction.deferReply();

  let creators;
  try {
    const webEnv = loadCreatorWebEnv();
    creators = await listApprovedCreatorsForDirectory(webEnv);
  } catch (err) {
    console.error("[creator] /leaderboard load:", err);
    await interaction.editReply({
      content:
        "Couldn't load the leaderboard right now. Try again in a moment.",
    });
    return;
  }

  const challenge = buildRoadTo1MChallenge(creators);
  const top = challenge.leaderboard.slice(0, 10);
  const siteBase = env.VFL_SITE_URL.replace(/\/$/, "");
  const leaderboardUrl = `${siteBase}/content/creators#leaderboard`;

  const targetFormatted = new Intl.NumberFormat(undefined).format(
    ROAD_TO_1M_TARGET_VIEWS,
  );
  const totalsFormatted = new Intl.NumberFormat(undefined).format(
    challenge.totalTrackedViews,
  );
  const progressPctRendered = challenge.progressPercent.toFixed(1);

  const embed = new EmbedBuilder()
    .setColor(0x083696)
    .setTitle("VF Create · Road to 1M Leaderboard")
    .setURL(leaderboardUrl)
    .setDescription(
      [
        `**Pool:** ${formatChallengeRobux(challenge.prizePoolRobux)} · split by view share when the community hits 1M.`,
        `**Progress:** ${totalsFormatted} / ${targetFormatted} views & plays (${progressPctRendered}%)`,
        `${challenge.participantCount} creator${challenge.participantCount === 1 ? "" : "s"} with links · ${challenge.totalPostCount} post${challenge.totalPostCount === 1 ? "" : "s"} live`,
      ].join("\n"),
    )
    .setFooter({ text: "VF Create · Top 10 · web leaderboard for full details" })
    .setTimestamp(new Date());

  if (top.length === 0) {
    embed.addFields({
      name: "Nobody on the board yet",
      value: [
        "Approved creators: post a VF video on TikTok or YouTube, then run",
        "`/posted url:<your link>` to claim a spot.",
        "",
        `Web leaderboard → ${leaderboardUrl}`,
      ].join("\n"),
      inline: false,
    });
  } else {
    const lines = top.map((row) => {
      const rankBadge =
        LEADERBOARD_RANK_EMOJI[row.rank] ??
        `\`#${String(row.rank).padStart(2, " ")}\``;
      const viewsLabel = formatViewsCompact(row.totalViews);
      const shareLabel = formatPoolSharePercent(row.poolSharePercent);
      const robuxLabel = formatChallengeRobux(row.estimatedPayoutRobux);
      const country = countryName(row.country);
      const meta = country ? ` · ${country}` : "";
      return [
        `${rankBadge} **${row.displayName}**${meta}`,
        `   ${viewsLabel} views · ${row.postCount} post${row.postCount === 1 ? "" : "s"} · ${shareLabel} share · est. ${robuxLabel}`,
      ].join("\n");
    });

    // Discord embed description has a 4096 char cap; rebuild description with
    // the leaderboard inline so each row stays together. (Adding 10 fields
    // works too, but the inline list reads better on mobile.)
    const headerLines = [
      `**Pool:** ${formatChallengeRobux(challenge.prizePoolRobux)} · split by view share when the community hits 1M.`,
      `**Progress:** ${totalsFormatted} / ${targetFormatted} views & plays (${progressPctRendered}%)`,
      `${challenge.participantCount} creator${challenge.participantCount === 1 ? "" : "s"} with links · ${challenge.totalPostCount} post${challenge.totalPostCount === 1 ? "" : "s"} live`,
      "",
    ];
    embed.setDescription([...headerLines, ...lines].join("\n").slice(0, 4096));
  }

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setLabel("Open the leaderboard")
      .setStyle(ButtonStyle.Link)
      .setURL(leaderboardUrl),
  );

  await interaction.editReply({ embeds: [embed], components: [row] });
}

export async function handleCreatorRemoveFromDbCommand(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  if (!interaction.guild || !interaction.member) {
    await interaction.reply({
      flags: MessageFlags.Ephemeral,
      content: "Use this command inside the server.",
    });
    return;
  }

  if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageRoles)) {
    await interaction.reply({
      flags: MessageFlags.Ephemeral,
      content: "You need **Manage Roles** to remove creator database rows.",
    });
    return;
  }

  const target = interaction.options.getUser("user", true);
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const targetId = target.id;
  const supabase = createBotSupabase();

  const { data: rows, error: selErr } = await supabase
    .from("creator_applications")
    .select("id")
    .eq("discord_id", targetId);

  if (selErr) {
    console.error("[creator] creator-remove select:", selErr);
    await interaction.editReply({
      content: "Database error while looking up applications.",
    });
    return;
  }

  const count = rows?.length ?? 0;
  if (count === 0) {
    await interaction.editReply({
      content: `${target} has no **creator_applications** rows — nothing to delete.`,
    });
    return;
  }

  const { error: delErr } = await supabase
    .from("creator_applications")
    .delete()
    .eq("discord_id", targetId);

  if (delErr) {
    console.error("[creator] creator-remove delete:", delErr);
    await interaction.editReply({
      content: "Database error while deleting applications.",
    });
    return;
  }

  let roleNote = "";
  const scoutRole = env.DISCORD_SCOUT_ROLE_ID?.trim();
  if (scoutRole) {
    try {
      const guild = await interaction.client.guilds.fetch(vfGuildId());
      const member = await guild.members.fetch(targetId).catch(() => null);
      if (member?.roles.cache.has(scoutRole)) {
        await member.roles.remove(
          scoutRole,
          `Creator records removed by ${interaction.user.tag}`,
        );
        roleNote =
          " Removed their **VF Create** role in the creator Discord server.";
      } else if (member) {
        roleNote =
          " They were not wearing the VF Create role in the creator Discord server.";
      } else {
        roleNote =
          " They are not in the creator Discord server — role left unchanged.";
      }
    } catch (e) {
      console.error("[creator] creator-remove role:", e);
      roleNote =
        " Could not update Discord roles — check bot **Manage Roles** in the creator server.";
    }
  }

  await interaction.editReply({
    content: `Deleted **${count}** row(s) from \`creator_applications\` for ${target}.${roleNote}`,
  });
}

export async function handleCreatorProfileCommand(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  const target = interaction.options.getUser("user") ?? interaction.user;
  const invokerIsTarget = interaction.user.id === target.id;

  await interaction.deferReply();

  const supabase = createBotSupabase();
  const { data, error } = await supabase
    .from("creator_applications")
    .select(
      "id, discord_id, discord_username, discord_avatar_url, roblox_id, roblox_username, roblox_avatar_url, tiktok_handle, youtube_handle, age, country, play_platform, status, approved_by, approved_at, rejection_reason, posted_video_links, created_at, updated_at",
    )
    .eq("discord_id", target.id)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("[creator] /creator lookup:", error);
    await interaction.editReply({
      content: "Couldn’t look up that profile right now. Try again in a minute.",
    });
    return;
  }

  if (!data) {
    await interaction.editReply({
      content: invokerIsTarget
        ? "You don’t have a creator application on file. Look for the **Start application** card in the creator server."
        : `${target.tag ?? target.username ?? `<@${target.id}>`} has no creator application on file.`,
    });
    return;
  }

  const row = data as CreatorRow;
  const meta = STATUS_META[row.status];
  const country = countryName(row.country);
  const playsOn = formatCreatorPlayPlatform(row.play_platform);
  const tiktokUrl = tiktokProfileHref(row.tiktok_handle);
  const youtubeUrl = youtubeProfileHref(row.youtube_handle);
  const tt = socialProfileLabel(row.tiktok_handle);
  const yt = socialProfileLabel(row.youtube_handle);

  const displayName =
    row.discord_username?.trim() || target.globalName || target.username;
  const avatar =
    row.roblox_avatar_url?.trim() || row.discord_avatar_url?.trim() || null;

  const embed = new EmbedBuilder()
    .setColor(meta.color)
    .setAuthor({
      name: "VF Create Program",
      iconURL: interaction.client.user?.displayAvatarURL({ size: 64 }) ?? undefined,
    })
    .setTitle(displayName)
    .setDescription(
      [
        `**${meta.label}**`,
        "",
        meta.line,
        "",
        `Requested by ${interaction.user}`,
      ].join("\n"),
    )
    .addFields(
      {
        name: "Roblox",
        value: row.roblox_username?.trim()
          ? `\`${row.roblox_username.trim()}\``
          : "*Not set*",
        inline: true,
      },
      {
        name: "Discord",
        value: `<@${row.discord_id}>`,
        inline: true,
      },
      { name: "\u200b", value: "\u200b", inline: false },
      {
        name: "Socials",
        value: (() => {
          const lines: string[] = [];
          if (tiktokUrl) {
            lines.push(`[TikTok — ${tt ?? "open"}](${tiktokUrl})`);
          }
          if (youtubeUrl) {
            lines.push(`[YouTube — ${yt ?? "open"}](${youtubeUrl})`);
          }
          return lines.length > 0 ? lines.join("\n\n") : "*None on file*";
        })(),
        inline: false,
      },
      {
        name: "Region",
        value: country ? `\`${country}\`` : "*Not set*",
        inline: true,
      },
      {
        name: "Plays on",
        value: playsOn ? `\`${playsOn}\`` : "*Not set*",
        inline: true,
      },
    )
    .setFooter({ text: "Profile updated" })
    .setTimestamp(new Date(row.updated_at));

  if (avatar) embed.setThumbnail(avatar);

  if (row.status === "approved" && row.approved_at) {
    const ts = Math.floor(new Date(row.approved_at).getTime() / 1000);
    const by = row.approved_by ? `<@${row.approved_by}>` : "staff";
    embed.addFields({
      name: "Approved",
      value: `Staff review by ${by}\n<t:${ts}:F>`,
      inline: false,
    });
    const posted = parsePostedVideoLinks(row.posted_video_links);
    if (posted.length > 0) {
      const lines = [...posted]
        .sort(
          (a, b) =>
            new Date(b.posted_at).getTime() - new Date(a.posted_at).getTime(),
        )
        .slice(0, 6)
        .map((l) => {
          let host = "Post";
          try {
            host = new URL(l.url).hostname.replace(/^www\./, "");
          } catch {
            /* keep label */
          }
          return `▸ [${host}](${l.url})`;
        })
        .join("\n");
      embed.addFields({
        name: "Directory posts",
        value: lines.slice(0, 1024),
        inline: false,
      });
    }
  }

  if (row.status === "rejected") {
    if (row.rejection_reason && invokerIsTarget) {
      embed.addFields({
        name: "Rejection note",
        value: row.rejection_reason.slice(0, 1024),
        inline: false,
      });
    } else if (row.approved_by) {
      embed.addFields({
        name: "Review",
        value: `Processed by <@${row.approved_by}>`,
        inline: false,
      });
    }
  }

  await interaction.editReply({ embeds: [embed] });

  // Age is never shown on the public embed. Only the person who ran the
  // command, when viewing their own profile, gets it in a private follow-up.
  if (invokerIsTarget && row.age != null) {
    await interaction.followUp({
      flags: MessageFlags.Ephemeral,
      content: `**Private** — your age on file is **${row.age}**. Only you can see this message.`,
    });
  }
}

export async function handleCreatorPostedCommand(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  if (!interaction.guild || !interaction.member) {
    await interaction.reply({
      flags: MessageFlags.Ephemeral,
      content: "Use `/posted` inside the VF Discord server.",
    });
    return;
  }

  const scoutRole = env.DISCORD_SCOUT_ROLE_ID?.trim();
  if (!scoutRole) {
    await interaction.reply({
      flags: MessageFlags.Ephemeral,
      content:
        "The VF Create creator role isn’t configured on the bot yet. Ask staff to set `DISCORD_SCOUT_ROLE_ID`.",
    });
    return;
  }

  const member = interaction.member as GuildMember;
  if (!member.roles.cache.has(scoutRole)) {
    await interaction.reply({
      flags: MessageFlags.Ephemeral,
      content:
        "You need the **VF Create** creator role to add directory posts. If you’re approved and don’t have it yet, ask staff.",
    });
    return;
  }

  const raw = interaction.options.getString("link", true);
  const url = validatePostedHttpsUrl(raw);
  if (!url) {
    await interaction.reply({
      flags: MessageFlags.Ephemeral,
      content:
        "That doesn’t look like a valid **https://** link. Paste the full URL from the address bar or share sheet.",
    });
    return;
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const supabase = createBotSupabase();
  const { data, error } = await supabase
    .from("creator_applications")
    .select("id, posted_video_links")
    .eq("discord_id", interaction.user.id)
    .eq("status", "approved")
    .maybeSingle();

  if (error) {
    console.error("[creator] /posted lookup:", error);
    await interaction.editReply({
      content: "Couldn’t update your profile right now. Try again shortly.",
    });
    return;
  }

  if (!data) {
    await interaction.editReply({
      content:
        "No **approved** VF Create profile is linked to your Discord account. Finish onboarding and get approved first.",
    });
    return;
  }

  const row = data as { id: string; posted_video_links: unknown };
  const existing = parsePostedVideoLinks(row.posted_video_links);
  if (existing.some((e) => postedUrlsEffectivelyEqual(e.url, url))) {
    await interaction.editReply({
      content: "That URL is already on your directory profile.",
    });
    return;
  }

  if (existing.length >= MAX_POSTED_LINKS_PER_CREATOR) {
    await interaction.editReply({
      content: `You already have **${MAX_POSTED_LINKS_PER_CREATOR}** links saved. Ask staff if you need to clear old ones.`,
    });
    return;
  }

  const next: { url: string; posted_at: string }[] = [
    ...existing,
    { url, posted_at: new Date().toISOString() },
  ];
  const updatedAt = new Date().toISOString();

  const { error: upErr } = await supabase
    .from("creator_applications")
    .update({
      posted_video_links: next,
      updated_at: updatedAt,
    })
    .eq("id", row.id);

  if (upErr) {
    console.error("[creator] /posted update:", upErr);
    await interaction.editReply({
      content: "Couldn’t save that link. Try again or ask staff to check the database.",
    });
    return;
  }

  const siteBase = env.VFL_SITE_URL.replace(/\/$/, "");
  const directoryUrl = `${siteBase}/content/creators`;

  await interaction.editReply({
    content: [
      "Added to your **VF Create directory** profile.",
      `<${directoryUrl}>`,
      "",
      `**Saved** · \`${url.length > 120 ? `${url.slice(0, 117)}…` : url}\``,
    ].join("\n"),
  });

  const logChannelId = env.DISCORD_CREATOR_POSTED_LOG_CHANNEL_ID?.trim();
  if (logChannelId) {
    const totalPosts = next.length;
    const logEmbed = new EmbedBuilder()
      .setColor(0x3b82f6)
      .setTitle("New VF Create post")
      .setDescription(
        [
          `${interaction.user} added a directory post.`,
          "",
          `**Link** · ${url}`,
        ].join("\n"),
      )
      .addFields(
        {
          name: "Creator",
          value: `<@${interaction.user.id}>\n\`${interaction.user.tag}\``,
          inline: true,
        },
        {
          name: "Posts on profile",
          value: `\`${totalPosts}\``,
          inline: true,
        },
        {
          name: "Profile",
          value: `[Open directory](${directoryUrl})`,
          inline: false,
        },
      )
      .setFooter({ text: "VF Create · /posted log" })
      .setTimestamp(new Date());

    void (async () => {
      try {
        const ch = await interaction.client.channels.fetch(logChannelId);
        if (ch?.isTextBased() && ch.isSendable()) {
          await ch.send({ embeds: [logEmbed] });
        }
      } catch (e) {
        console.error("[creator] /posted log post:", e);
      }
    })();
  }
}

export async function handleCreatorPostRemoveCommand(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  if (!interaction.guild || !interaction.member) {
    await interaction.reply({
      flags: MessageFlags.Ephemeral,
      content: "Use `/post-remove` inside the VF Discord server.",
    });
    return;
  }

  const scoutRole = env.DISCORD_SCOUT_ROLE_ID?.trim();
  if (!scoutRole) {
    await interaction.reply({
      flags: MessageFlags.Ephemeral,
      content:
        "The VF Create creator role isn’t configured on the bot yet. Ask staff to set `DISCORD_SCOUT_ROLE_ID`.",
    });
    return;
  }

  const member = interaction.member as GuildMember;
  if (!member.roles.cache.has(scoutRole)) {
    await interaction.reply({
      flags: MessageFlags.Ephemeral,
      content:
        "You need the **VF Create** creator role to request removals.",
    });
    return;
  }

  const channelId = env.DISCORD_CREATOR_APPROVAL_CHANNEL_ID?.trim();
  if (!channelId) {
    await interaction.reply({
      flags: MessageFlags.Ephemeral,
      content:
        "Staff approval channel isn’t configured (`DISCORD_CREATOR_APPROVAL_CHANNEL_ID`).",
    });
    return;
  }

  const raw = interaction.options.getString("link", true);
  const url = validatePostedHttpsUrl(raw);
  if (!url) {
    await interaction.reply({
      flags: MessageFlags.Ephemeral,
      content:
        "That doesn’t look like a valid **https://** link. Paste the exact URL from your directory profile.",
    });
    return;
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const supabase = createBotSupabase();
  const { data, error } = await supabase
    .from("creator_applications")
    .select("id, discord_username, roblox_username, posted_video_links")
    .eq("discord_id", interaction.user.id)
    .eq("status", "approved")
    .maybeSingle();

  if (error) {
    console.error("[creator] /post-remove lookup:", error);
    await interaction.editReply({
      content: "Couldn’t reach the database. Try again shortly.",
    });
    return;
  }

  if (!data) {
    await interaction.editReply({
      content:
        "No **approved** VF Create profile is linked to your Discord account.",
    });
    return;
  }

  const appRow = data as {
    id: string;
    discord_username: string | null;
    roblox_username: string | null;
    posted_video_links: unknown;
  };

  const siteBase = env.VFL_SITE_URL.replace(/\/$/, "");
  const directoryUrl = `${siteBase}/content/creators`;

  const existing = parsePostedVideoLinks(appRow.posted_video_links);
  if (!existing.some((e) => postedUrlsEffectivelyEqual(e.url, url))) {
    await interaction.editReply({
      content: [
        "That URL isn’t on your directory profile. Copy it from **`/creator`** or the site:",
        directoryUrl,
        "It must match **exactly** (same tracking params, etc.).",
      ].join("\n"),
    });
    return;
  }

  const description = [
    `${interaction.user} · \`${interaction.user.tag}\` wants **staff to remove** this VF Create directory post.`,
    "",
    POST_REMOVE_URL_MARKER,
    url,
  ].join("\n");

  if (description.length > 4096) {
    await interaction.editReply({
      content: "That URL is too long for Discord to queue for review. Ask staff to remove it manually.",
    });
    return;
  }

  const embed = new EmbedBuilder()
    .setTitle("VF Create — remove directory post")
    .setColor(0xf97316)
    .setDescription(description)
    .addFields(
      {
        name: "Application ID",
        value: `\`${appRow.id}\``,
        inline: true,
      },
      {
        name: "Roblox",
        value: appRow.roblox_username?.trim()
          ? `\`${appRow.roblox_username.trim()}\``
          : "—",
        inline: true,
      },
    )
    .setFooter({ text: "Pending staff approval — same channel as new applications" })
    .setTimestamp(new Date());

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`${CREATOR_POST_REMOVE_APPROVE_PREFIX}${appRow.id}`)
      .setLabel("Approve removal")
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(`${CREATOR_POST_REMOVE_REJECT_PREFIX}${appRow.id}`)
      .setLabel("Reject")
      .setStyle(ButtonStyle.Danger),
  );

  try {
    const ch = await interaction.client.channels.fetch(channelId);
    if (!ch?.isTextBased() || !ch.isSendable()) {
      await interaction.editReply({
        content: "Approval channel exists but the bot can’t post there (type / permissions).",
      });
      return;
    }
    await ch.send({ embeds: [embed], components: [row] });
  } catch (e) {
    console.error("[creator] /post-remove channel send:", e);
    await interaction.editReply({
      content: "Couldn’t post the review card. Ask staff to check bot access to the approval channel.",
    });
    return;
  }

  await interaction.editReply({
    content:
      "Sent to **staff** for approval in the creator review channel. You’ll get a DM when it’s approved or rejected.",
  });
}

export async function handleCreatorPostRemoveApproveButton(
  interaction: ButtonInteraction,
  applicationId: string,
): Promise<void> {
  if (!ensureManageRoles(interaction)) return;

  await interaction.deferUpdate();

  const embed0Raw = interaction.message.embeds[0];
  if (!embed0Raw) {
    await interaction.followUp({
      ephemeral: true,
      content: "This card has no embed — can’t process.",
    });
    return;
  }

  const url = extractPostRemovalUrlFromEmbed(embed0Raw.description);
  if (!url) {
    await interaction.followUp({
      ephemeral: true,
      content: "Could not read the URL from this card.",
    });
    return;
  }

  const adminId = interaction.user.id;
  const supabase = createBotSupabase();
  const { data: row, error: fetchErr } = await supabase
    .from("creator_applications")
    .select("id, discord_id, posted_video_links, status")
    .eq("id", applicationId)
    .maybeSingle();

  if (fetchErr || !row) {
    await interaction.followUp({
      ephemeral: true,
      content: "Creator application not found.",
    });
    return;
  }

  const rec = row as {
    id: string;
    discord_id: string;
    posted_video_links: unknown;
    status: string;
  };

  if (rec.status !== "approved") {
    await interaction.followUp({
      ephemeral: true,
      content: "That application is not approved — nothing to update.",
    });
    return;
  }

  const links = parsePostedVideoLinks(rec.posted_video_links);
  const idx = links.findIndex((e) => postedUrlsEffectivelyEqual(e.url, url));
  if (idx < 0) {
    await interaction.followUp({
      ephemeral: true,
      content:
        "That URL is not on this creator’s profile anymore (already removed or URL mismatch).",
    });
    return;
  }

  const next = links.filter((_, i) => i !== idx);
  const now = new Date().toISOString();

  const { error: upErr } = await supabase
    .from("creator_applications")
    .update({
      posted_video_links: next,
      updated_at: now,
    })
    .eq("id", applicationId)
    .eq("status", "approved");

  if (upErr) {
    console.error("[creator] post-remove approve:", upErr);
    await interaction.followUp({
      ephemeral: true,
      content: "Database error while removing the link.",
    });
    return;
  }

  try {
    const u = await interaction.client.users.fetch(rec.discord_id);
    await u.send({
      content: [
        "**VF Create** — staff **approved** removing your directory post.",
        "",
        `Removed: ${url.length > 500 ? `${url.slice(0, 497)}…` : url}`,
      ].join("\n"),
    });
  } catch {
    /* DMs closed */
  }

  const builder = EmbedBuilder.from(embed0Raw);
  builder.setColor(0x10b981).addFields({
    name: "Approved removal",
    value: `By <@${adminId}> at <t:${Math.floor(Date.now() / 1000)}:F>`,
    inline: false,
  });

  await interaction.editReply({
    embeds: [builder],
    components: [],
  });
}

export async function handleCreatorPostRemoveRejectButton(
  interaction: ButtonInteraction,
  applicationId: string,
): Promise<void> {
  if (!ensureManageRoles(interaction)) return;

  const msgId = interaction.message.id;
  const modal = new ModalBuilder()
    .setCustomId(
      `${CREATOR_POST_REMOVE_REJECT_MODAL_PREFIX}${applicationId}|${msgId}`,
    )
    .setTitle("Reject post removal");

  const input = new TextInputBuilder()
    .setCustomId("rejection_reason")
    .setLabel("Reason (optional)")
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(false)
    .setMaxLength(500);

  modal.addComponents(
    new ActionRowBuilder<TextInputBuilder>().addComponents(input),
  );

  await interaction.showModal(modal);
}

export async function handleCreatorPostRemoveRejectModal(
  interaction: ModalSubmitInteraction,
): Promise<void> {
  const raw = interaction.customId.slice(
    CREATOR_POST_REMOVE_REJECT_MODAL_PREFIX.length,
  );
  const pipe = raw.indexOf("|");
  if (pipe <= 0) {
    await interaction.reply({
      ephemeral: true,
      content: "Invalid modal.",
    });
    return;
  }
  const appId = raw.slice(0, pipe);
  const messageId = raw.slice(pipe + 1);

  await interaction.deferReply({ ephemeral: true });

  const reason =
    interaction.fields.getTextInputValue("rejection_reason")?.trim() || null;
  const adminId = interaction.user.id;

  const supabase = createBotSupabase();
  const { data: row, error: fetchErr } = await supabase
    .from("creator_applications")
    .select("discord_id")
    .eq("id", appId)
    .maybeSingle();

  if (fetchErr || !row) {
    await interaction.editReply({
      content: "Application not found.",
    });
    return;
  }

  const discordId = String(
    (row as { discord_id: string | null }).discord_id ?? "",
  );

  try {
    if (discordId) {
      const u = await interaction.client.users.fetch(discordId);
      await u.send({
        content: [
          "**VF Create** — staff **did not approve** removing your directory post.",
          reason ? `\n\nReason: ${reason}` : "",
        ].join(""),
      });
    }
  } catch {
    /* DMs closed */
  }

  const channelId = interaction.channelId;
  if (channelId) {
    try {
      const ch = await interaction.client.channels.fetch(channelId);
      if (ch?.isTextBased()) {
        const msg = await ch.messages.fetch(messageId);
        if (msg.embeds[0]) {
          const builder = EmbedBuilder.from(msg.embeds[0]!);
          builder.setColor(0xef4444).addFields({
            name: "Removal rejected",
            value: `By <@${adminId}>${reason ? `\n> ${reason}` : ""}`,
            inline: false,
          });
          await msg.edit({
            embeds: [builder],
            components: [],
          });
        }
      }
    } catch (e) {
      console.error("[creator] post-remove reject message edit:", e);
    }
  }

  await interaction.editReply({
    content: "Rejection recorded. Creator notified if DMs are open.",
  });
}
