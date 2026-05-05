import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  EmbedBuilder,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
  type AutocompleteInteraction,
  type ChatInputCommandInteraction,
  type GuildBasedChannel,
  type GuildMember,
  type GuildTextBasedChannel,
} from "discord.js";

import { env } from "@/bot/config";
import { getRobloxHeadshotsForBot } from "@/lib/roblox";
import {
  buildTeamNameBySlug,
  createBotSupabase,
  fetchPlayerCareer,
  fetchSquadForSeason,
  fetchTeamSeasonHonors,
  fetchTeamSeasonManagerName,
  fetchTeamSeasonRecord,
  filterTeamsForAutocomplete,
  findPlayerByDiscordId,
  findPlayersByUsername,
  formatHonorList,
  loadTeams,
  resolveTeamForSlashCommand,
} from "@/bot/stats-queries";
import {
  APPROVE_BUTTON_ID_PREFIX,
  DENY_BUTTON_ID_PREFIX,
} from "@/bot/sync";
import {
  CONTRACT_POSITION_CHOICES,
  CONTRACT_ROLE_CHOICES,
  handleContractCommand,
} from "@/bot/contracts";
import {
  handleFreeAgent,
  handleFriendly,
  handleScouting,
} from "@/bot/marketplace";
import { handleReleaseCommand } from "@/bot/release";

function formatCommandError(err: unknown): string {
  if (err instanceof Error && err.message.trim()) return err.message.trim();
  if (typeof err === "object" && err !== null) {
    const o = err as Record<string, unknown>;
    const m = o.message ?? o.error_description;
    if (typeof m === "string" && m.trim()) return m.trim();
    const parts = [o.code, o.details, o.hint]
      .filter((x) => typeof x === "string" && String(x).trim())
      .map(String);
    if (parts.length) return parts.join(" · ");
  }
  if (typeof err === "string" && err.trim()) return err.trim();
  return "unknown error";
}

/**
 * Verified-only gate for read commands like `/team` and `/player`. Anyone in the
 * server who completed Roblox-Discord verification (and therefore has the
 * verified role) may use them; everyone else gets a friendly nudge.
 *
 * Bypasses: server admins (Manage Guild) and the team-manager role. Staff
 * shouldn't need to walk through the website verify flow to read club info.
 */
async function requireVerifiedRole(
  interaction: ChatInputCommandInteraction,
): Promise<boolean> {
  if (!interaction.guild || !interaction.member) {
    await interaction.reply({
      flags: MessageFlags.Ephemeral,
      content: "Use this command inside the server.",
    });
    return false;
  }
  const member = interaction.member as GuildMember;
  const isAdmin = Boolean(
    interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild) ||
      interaction.memberPermissions?.has(PermissionFlagsBits.Administrator),
  );
  const hasVerified = member.roles.cache.has(env.DISCORD_ROVER_VERIFIED_ROLE_ID);
  const hasApproved = member.roles.cache.has(env.DISCORD_APPROVED_ROLE_ID);
  const hasManager = member.roles.cache.has(env.DISCORD_TEAM_MANAGER_ROLE_ID);
  if (isAdmin || hasVerified || hasApproved || hasManager) return true;
  const ownedRoleIds = [...member.roles.cache.keys()].join(", ");
  console.log(
    `[gate] Denied /${interaction.commandName} for ${interaction.user.tag} (${interaction.user.id}). ` +
      `Required one of [verified=${env.DISCORD_ROVER_VERIFIED_ROLE_ID}, approved=${env.DISCORD_APPROVED_ROLE_ID}, manager=${env.DISCORD_TEAM_MANAGER_ROLE_ID}]. ` +
      `User has [${ownedRoleIds}].`,
  );
  await interaction.reply({
    flags: MessageFlags.Ephemeral,
    content:
      "You need to verify on the website first. Run `/postverify` in the verify channel for the link.",
  });
  return false;
}

/** Crest/logo for Discord embeds (DB often stores `/file.png` — absolute + path-encoded). */
function absoluteSiteAssetUrl(
  pathOrUrl: string | null | undefined,
  siteBaseRaw: string,
): string | null {
  const raw = pathOrUrl?.trim();
  if (!raw) return null;

  try {
    if (raw.startsWith("https://") || raw.startsWith("http://")) {
      const u = new URL(raw);
      return u.href;
    }

    const baseStr = siteBaseRaw.replace(/\/$/, "").trim();
    if (!baseStr) return null;
    const base = new URL(baseStr);

    const rel = raw.startsWith("/") ? raw.slice(1) : raw;
    const pathEncoded =
      "/" +
      rel
        .split("/")
        .filter(Boolean)
        .map((segment) => {
          try {
            return encodeURIComponent(decodeURIComponent(segment));
          } catch {
            return encodeURIComponent(segment);
          }
        })
        .join("/");

    const out = `${base.origin}${pathEncoded}`;
    const check = new URL(out);
    if (check.protocol !== "http:" && check.protocol !== "https:") return null;
    return check.href;
  } catch {
    return null;
  }
}

export const slashCommandDefinitions = [
  new SlashCommandBuilder()
    .setName("backlog")
    .setDescription(
      "Show every pending whitelist request waiting on staff approval",
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
    .toJSON(),

  new SlashCommandBuilder()
    .setName("postverify")
    .setDescription(
      "Post the VFL website verification card (Click to verify) in this channel",
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .toJSON(),

  new SlashCommandBuilder()
    .setName("kick")
    .setDescription("Kick a user from the server")
    .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers)
    .addUserOption((opt) =>
      opt
        .setName("user")
        .setDescription("User to kick")
        .setRequired(true),
    )
    .addStringOption((opt) =>
      opt
        .setName("reason")
        .setDescription("Reason for the kick")
        .setRequired(false),
    )
    .toJSON(),

  new SlashCommandBuilder()
    .setName("ban")
    .setDescription("Ban a user from the server")
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
    .addUserOption((opt) =>
      opt
        .setName("user")
        .setDescription("User to ban")
        .setRequired(true),
    )
    .addStringOption((opt) =>
      opt
        .setName("reason")
        .setDescription("Reason for the ban")
        .setRequired(false),
    )
    .addIntegerOption((opt) =>
      opt
        .setName("delete_days")
        .setDescription("Days of message history to delete (0-7)")
        .setMinValue(0)
        .setMaxValue(7)
        .setRequired(false),
    )
    .toJSON(),

  new SlashCommandBuilder()
    .setName("player")
    .setDescription("VF profile: goals, assists, career, trophies, and more")
    .addUserOption((opt) =>
      opt
        .setName("member")
        .setDescription("Discord member (must be linked in VF database)")
        .setRequired(false),
    )
    .addStringOption((opt) =>
      opt
        .setName("roblox_username")
        .setDescription("Exact Roblox username as on the league site")
        .setRequired(false),
    )
    .toJSON(),

  new SlashCommandBuilder()
    .setName("team")
    .setDescription("Club season record, honors, and link to the site")
    .addStringOption((opt) =>
      opt
        .setName("team")
        .setDescription("Club — pick from suggestions or type name/slug")
        .setRequired(true)
        .setAutocomplete(true),
    )
    .addIntegerOption((opt) =>
      opt
        .setName("season")
        .setDescription("Season number (e.g. 1 or 2)")
        .setRequired(true)
        .setMinValue(1)
        .setMaxValue(20),
    )
    .toJSON(),

  new SlashCommandBuilder()
    .setName("appoint")
    .setDescription(
      "Appoint a club/nation manager for a season (Manage Server or owner).",
    )
    .addStringOption((opt) =>
      opt
        .setName("team")
        .setDescription("Club or nation — pick from suggestions or type name/slug")
        .setRequired(true)
        .setAutocomplete(true),
    )
    .addIntegerOption((opt) =>
      opt
        .setName("season")
        .setDescription("Season (1–3)")
        .setRequired(true)
        .setMinValue(1)
        .setMaxValue(3),
    )
    .addUserOption((opt) =>
      opt
        .setName("manager")
        .setDescription("Discord user (must be linked in VF players table)")
        .setRequired(true),
    )
    .toJSON(),

  new SlashCommandBuilder()
    .setName("contract")
    .setDescription(
      "Offer a roster contract for the active season (club manager role only)",
    )
    .addStringOption((opt) =>
      opt
        .setName("team")
        .setDescription("Club you’re signing for — pick from suggestions")
        .setRequired(true)
        .setAutocomplete(true),
    )
    .addUserOption((opt) =>
      opt
        .setName("player")
        .setDescription("Player to sign (Discord — must be linked in VF)")
        .setRequired(true),
    )
    .addStringOption((opt) =>
      opt
        .setName("position")
        .setDescription("Tactical position on the sheet")
        .setRequired(true)
        .addChoices(...CONTRACT_POSITION_CHOICES),
    )
    .addStringOption((opt) =>
      opt
        .setName("role")
        .setDescription("Squad role (starter through reserve)")
        .setRequired(true)
        .addChoices(...CONTRACT_ROLE_CHOICES),
    )
    .toJSON(),

  new SlashCommandBuilder()
    .setName("release")
    .setDescription(
      "Request to remove a player from your roster (staff approves in review channel)",
    )
    .addStringOption((opt) =>
      opt
        .setName("team")
        .setDescription("Club to release from — pick from suggestions")
        .setRequired(true)
        .setAutocomplete(true),
    )
    .addUserOption((opt) =>
      opt
        .setName("player")
        .setDescription("Player to release from your team’s active-season sheet")
        .setRequired(true),
    )
    .addStringOption((opt) =>
      opt
        .setName("reason")
        .setDescription("Optional note for staff")
        .setRequired(false)
        .setMaxLength(500),
    )
    .toJSON(),

  new SlashCommandBuilder()
    .setName("freeagent")
    .setDescription(
      "Post yourself in the free‑agent channel (one post per 6 hours)",
    )
    .addStringOption((opt) =>
      opt
        .setName("position")
        .setDescription("Position you want to play")
        .setRequired(true)
        .addChoices(...CONTRACT_POSITION_CHOICES),
    )
    .toJSON(),

  new SlashCommandBuilder()
    .setName("friendly")
    .setDescription(
      "Post a friendly request in the friendly‑finder channel (club managers)",
    )
    .addStringOption((opt) =>
      opt
        .setName("team")
        .setDescription("Club you’re posting for — pick from suggestions")
        .setRequired(true)
        .setAutocomplete(true),
    )
    .addStringOption((opt) =>
      opt
        .setName("time")
        .setDescription("When you want to play (e.g. \"Tonight 8pm EST\")")
        .setRequired(true)
        .setMaxLength(200),
    )
    .addStringOption((opt) =>
      opt
        .setName("notes")
        .setDescription("Optional context (format, server, restrictions)")
        .setRequired(false)
        .setMaxLength(500),
    )
    .toJSON(),

  new SlashCommandBuilder()
    .setName("scouting")
    .setDescription(
      "Post a scouting trial in the scouting channel (club managers)",
    )
    .addStringOption((opt) =>
      opt
        .setName("team")
        .setDescription("Club you’re recruiting for — pick from suggestions")
        .setRequired(true)
        .setAutocomplete(true),
    )
    .addStringOption((opt) =>
      opt
        .setName("position")
        .setDescription("Position you’re recruiting for")
        .setRequired(true)
        .addChoices(...CONTRACT_POSITION_CHOICES),
    )
    .addIntegerOption((opt) =>
      opt
        .setName("count")
        .setDescription("How many slots are open")
        .setRequired(true)
        .setMinValue(1)
        .setMaxValue(11),
    )
    .addStringOption((opt) =>
      opt
        .setName("notes")
        .setDescription("Optional context (style, requirements, trial info)")
        .setRequired(false)
        .setMaxLength(500),
    )
    .toJSON(),
];

export async function handleSlashCommand(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  switch (interaction.commandName) {
    case "backlog":
      await handleBacklog(interaction);
      return;
    case "postverify":
      await handlePostVerifyCard(interaction);
      return;
    case "kick":
      await handleKick(interaction);
      return;
    case "ban":
      await handleBan(interaction);
      return;
    case "player":
      await handlePlayer(interaction);
      return;
    case "team":
      await handleTeam(interaction);
      return;
    case "appoint":
      await handleAppoint(interaction);
      return;
    case "contract":
      await handleContractCommand(interaction);
      return;
    case "release":
      await handleReleaseCommand(interaction);
      return;
    case "freeagent":
      await handleFreeAgent(interaction);
      return;
    case "friendly":
      await handleFriendly(interaction);
      return;
    case "scouting":
      await handleScouting(interaction);
      return;
    default:
      await interaction.reply({
        flags: MessageFlags.Ephemeral,
        content: "Unknown command.",
      });
  }
}

export async function handleAutocomplete(
  interaction: AutocompleteInteraction,
): Promise<void> {
  const teamAutocompleteCommands = new Set([
    "team",
    "appoint",
    "contract",
    "release",
    "friendly",
    "scouting",
  ]);
  if (!teamAutocompleteCommands.has(interaction.commandName)) return;

  const focused = interaction.options.getFocused(true);
  if (focused.name !== "team") return;

  try {
    const supabase = createBotSupabase();
    const teamRows = await loadTeams(supabase);
    const matches = filterTeamsForAutocomplete(teamRows, String(focused.value));
    await interaction.respond(
      matches.map((t) => ({
        name: t.name.length > 100 ? `${t.name.slice(0, 97)}…` : t.name,
        value:
          t.slug.length > 100 ? `${t.slug.slice(0, 97)}…` : t.slug,
      })),
    );
  } catch {
    await interaction.respond([]);
  }
}

async function handlePlayer(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  if (!(await requireVerifiedRole(interaction))) return;
  const member = interaction.options.getUser("member");
  const usernameOpt = interaction.options.getString("roblox_username");

  if (!member && (!usernameOpt || !usernameOpt.trim())) {
    await interaction.reply({
      flags: MessageFlags.Ephemeral,
      content:
        "Provide either **member** (Discord user) or **roblox_username** (exact site name).",
    });
    return;
  }

  await interaction.deferReply();

  try {
    const supabase = createBotSupabase();
    let profile = null as Awaited<
      ReturnType<typeof findPlayerByDiscordId>
    > | null;

    if (member) {
      profile = await findPlayerByDiscordId(supabase, member.id);
    }

    if (!profile && usernameOpt?.trim()) {
      let candidates = await findPlayersByUsername(supabase, usernameOpt.trim());
      if (candidates.length === 0) {
        const { data, error } = await supabase
          .from("players")
          .select("*")
          .ilike("roblox_username", `%${usernameOpt.trim()}%`)
          .limit(5);
        if (error) throw error;
        candidates = (data ?? []) as typeof candidates;
      }
      if (candidates.length === 0) {
        await interaction.editReply({
          content: "No player found for that Discord link or Roblox username.",
        });
        return;
      }
      if (candidates.length > 1) {
        const list = candidates.map((p) => `\`${p.roblox_username}\``).join(", ");
        await interaction.editReply({
          content: `Several matches — be more specific: ${list}`,
        });
        return;
      }
      profile = candidates[0]!;
    }

    if (!profile) {
      await interaction.editReply({
        content:
          "No VF profile for that Discord user. Try **roblox_username** instead.",
      });
      return;
    }

    if (!profile.roblox_user_id?.trim()) {
      await interaction.editReply({
        content: `\`${profile.roblox_username}\` has no Roblox user id on file yet.`,
      });
      return;
    }

    const teamNames = await buildTeamNameBySlug(supabase);
    const careerLines = await fetchPlayerCareer(supabase, profile.id, teamNames);

    const robloxProfile = `https://www.roblox.com/users/${profile.roblox_user_id}/profile`;
    const siteProfile = `${env.VFL_SITE_URL.replace(/\/$/, "")}/players/${encodeURIComponent(profile.roblox_username)}`;
    const hostLabel = env.VFL_SITE_URL.replace(/^https?:\/\//, "").replace(/\/$/, "");

    const headshots = await getRobloxHeadshotsForBot(
      [profile.roblox_user_id],
      "420x420",
    );
    const robloxAvatarUrl = headshots.get(profile.roblox_user_id) ?? null;

    const ratingLine =
      profile.avg_rating != null && Number.isFinite(Number(profile.avg_rating))
        ? `**${profile.avg_rating}**`
        : "*—*";
    const appsLine =
      profile.appearances_total != null && profile.appearances_total > 0
        ? `**${profile.appearances_total}**`
        : "*—*";

    const trophiesText = formatHonorList(profile.trophies, 8).slice(0, 1024);
    const accoladesText = formatHonorList(profile.accolades, 8).slice(0, 1024);

    const identityLines = [
      `> **Roblox ID** · \`${profile.roblox_user_id}\``,
      profile.discord_username
        ? `> **Discord** · \`${profile.discord_username}\``
        : `> **Discord** · *not linked on profile*`,
      `> **Position** · ${profile.position?.trim() || "*—*"}`,
    ].join("\n");

    const careerBlock =
      careerLines.length > 0
        ? `\`\`\`\n${careerLines.slice(0, 14).join("\n")}${careerLines.length > 14 ? `\n… +${careerLines.length - 14} more` : ""}\n\`\`\``
        : "*No club seasons on file yet.*";

    const embed = new EmbedBuilder()
      .setColor(0x083696)
      .setAuthor({
        name: "VF League · Player profile",
        url: siteProfile,
      })
      .setTitle(profile.roblox_username)
      .setURL(siteProfile)
      .setDescription(
        [
          `[Roblox](${robloxProfile}) · [${hostLabel}](${siteProfile})`,
          "",
          identityLines,
        ].join("\n"),
      )
      .addFields(
        {
          name: "⚽ Goals",
          value: `**${profile.goals_total ?? 0}**`,
          inline: true,
        },
        {
          name: "🅰️ Assists",
          value: `**${profile.assists_total ?? 0}**`,
          inline: true,
        },
        {
          name: "⭐ Avg rating",
          value: ratingLine,
          inline: true,
        },
        {
          name: "📋 Appearances",
          value: appsLine,
          inline: true,
        },
        {
          name: "🏟️ Career · club by season",
          value: careerBlock.slice(0, 1024),
          inline: false,
        },
      )
      .setFooter({
        text: "VF League Database · Roblox avatar via thumbnails.roblox.com",
      })
      .setTimestamp(new Date());

    if (robloxAvatarUrl) {
      embed.setThumbnail(robloxAvatarUrl);
    }

    if (trophiesText !== "—") {
      embed.addFields({
        name: "🏆 Trophies",
        value: trophiesText,
        inline: false,
      });
    }

    if (accoladesText !== "—") {
      embed.addFields({
        name: "✨ Accolades",
        value: accoladesText,
        inline: false,
      });
    }

    await interaction.editReply({ embeds: [embed] });
  } catch (err) {
    const msg = formatCommandError(err);
    console.error("/player failed:", err);
    await interaction.editReply({ content: `Could not load player: ${msg}` });
  }
}

type SquadEntry = {
  roblox_username: string;
  position: string | null;
  games: number | null;
};

const SQUAD_POSITION_BUCKETS: ReadonlyArray<{
  label: string;
  match: (pos: string) => boolean;
}> = [
  { label: "🥅 Goalkeepers", match: (p) => p === "GK" },
  { label: "🛡️ Defenders", match: (p) => ["CB", "WB", "RB", "LB", "DEF"].includes(p) },
  { label: "⚙️ Midfielders", match: (p) => ["CDM", "CM", "CAM", "MID"].includes(p) },
  { label: "⚡ Forwards", match: (p) => ["ST", "LW", "RW", "CF", "FWD"].includes(p) },
];

function bucketSquadByPosition(squad: SquadEntry[]): {
  label: string;
  rows: SquadEntry[];
}[] {
  const buckets = SQUAD_POSITION_BUCKETS.map((b) => ({
    label: b.label,
    rows: [] as SquadEntry[],
    match: b.match,
  }));
  const other: SquadEntry[] = [];
  for (const row of squad) {
    const pos = (row.position ?? "").trim().toUpperCase();
    const target = buckets.find((b) => pos && b.match(pos));
    if (target) target.rows.push(row);
    else other.push(row);
  }
  const sortRows = (rows: SquadEntry[]) =>
    rows.sort((a, b) =>
      a.roblox_username
        .toLowerCase()
        .localeCompare(b.roblox_username.toLowerCase()),
    );
  for (const b of buckets) sortRows(b.rows);
  sortRows(other);
  const out = buckets
    .filter((b) => b.rows.length > 0)
    .map((b) => ({ label: b.label, rows: b.rows }));
  if (other.length > 0) out.push({ label: "❔ Unlisted", rows: other });
  return out;
}

function renderSquadBucketLines(rows: SquadEntry[]): string {
  return rows
    .map((row) => {
      const pos = (row.position ?? "").trim();
      const posChip = pos ? `\`${pos.padStart(3, " ")}\`` : "`   `";
      const appsLabel =
        row.games != null && row.games > 0
          ? ` · **${row.games}** ${row.games === 1 ? "app" : "apps"}`
          : " · *no apps yet*";
      return `${posChip}  **${row.roblox_username}**${appsLabel}`;
    })
    .join("\n");
}

async function handleTeam(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  if (!(await requireVerifiedRole(interaction))) return;
  const teamRaw = interaction.options.getString("team", true);
  const season = interaction.options.getInteger("season", true);

  await interaction.deferReply();

  try {
    const supabase = createBotSupabase();
    const teamRows = await loadTeams(supabase);
    const resolved = await resolveTeamForSlashCommand(supabase, teamRows, teamRaw);

    if (!resolved) {
      await interaction.editReply({
        content:
          "Could not resolve that club. Use the **team** autocomplete or type the exact slug (e.g. `andover-fc`).",
      });
      return;
    }

    const siteBase = env.VFL_SITE_URL.replace(/\/$/, "");
    const siteTeam = `${siteBase}/teams/${encodeURIComponent(resolved.slug)}`;
    const hostLabel = env.VFL_SITE_URL.replace(/^https?:\/\//, "").replace(/\/$/, "");
    const crestUrl = absoluteSiteAssetUrl(resolved.logo_url, siteBase);

    const [record, honors, managerName, squad] = await Promise.all([
      fetchTeamSeasonRecord(supabase, resolved.slug, season),
      fetchTeamSeasonHonors(supabase, resolved.slug, season),
      fetchTeamSeasonManagerName(supabase, resolved.slug, season),
      fetchSquadForSeason(supabase, resolved.slug, season),
    ]);

    const metaLines = [
      `> **Season** · **${season}**`,
      `> **Slug** · \`${resolved.slug}\``,
      resolved.abbreviation?.trim()
        ? `> **Short** · \`${resolved.abbreviation.trim()}\``
        : null,
    ]
      .filter(Boolean)
      .join("\n");

    const embed = new EmbedBuilder()
      .setColor(0x083696)
      .setAuthor({
        name: "VF League · Club",
        url: siteTeam,
      })
      .setTitle(resolved.name)
      .setURL(siteTeam)
      .setDescription(
        [`[Team page on ${hostLabel}](${siteTeam})`, "", metaLines].join(
          "\n",
        ),
      )
      .setFooter({
        text: "VF League Database · Crest from site when available",
      })
      .setTimestamp(new Date());

    if (crestUrl) embed.setThumbnail(crestUrl);

    embed.addFields({
      name: "Manager",
      value: managerName?.trim() ? managerName.trim() : "—",
      inline: false,
    });

    const played = record?.matches_played ?? 0;
    const wins = record?.wins ?? 0;
    const draws = record?.draws ?? 0;
    const losses = record?.losses ?? 0;
    const points = wins * 3 + draws;
    const maxPoints = played * 3;
    embed.addFields(
      { name: "📋 Played", value: `**${played}**`, inline: true },
      { name: "✅ Wins", value: `**${wins}**`, inline: true },
      { name: "🤝 Draws", value: `**${draws}**`, inline: true },
      { name: "❌ Losses", value: `**${losses}**`, inline: true },
      {
        name: "📈 League points",
        value:
          played > 0
            ? `**${points}** earned · **${maxPoints}** max *(3 pts win, 1 draw)*`
            : "*No completed matches yet — record will fill in once games are played.*",
        inline: false,
      },
    );

    if (honors.length > 0) {
      embed.addFields({
        name: "🏆 Honors",
        value: honors.map((h) => `▸ ${h}`).join("\n").slice(0, 1024),
        inline: false,
      });
    }

    const squadHeaderName = "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━";
    const squadHeaderValue =
      squad.length === 0
        ? `## 👥 Squad · Season ${season}\n_No players registered for this season yet._`
        : `## 👥 Squad · Season ${season}\n**${squad.length}** ${squad.length === 1 ? "player" : "players"} on the sheet`;
    embed.addFields({
      name: squadHeaderName,
      value: squadHeaderValue,
      inline: false,
    });

    if (squad.length > 0) {
      const buckets = bucketSquadByPosition(squad);
      let truncated = false;
      for (const bucket of buckets) {
        const lines = renderSquadBucketLines(bucket.rows);
        if (lines.length <= 1024) {
          embed.addFields({
            name: `${bucket.label}  ·  ${bucket.rows.length}`,
            value: lines,
            inline: false,
          });
          continue;
        }
        let kept = bucket.rows.length;
        let candidate = lines;
        while (candidate.length > 1024 && kept > 1) {
          kept -= 1;
          candidate = renderSquadBucketLines(bucket.rows.slice(0, kept));
        }
        const overflow = bucket.rows.length - kept;
        truncated = truncated || overflow > 0;
        const value =
          overflow > 0
            ? `${candidate}\n*…and ${overflow} more.*`.slice(0, 1024)
            : candidate;
        embed.addFields({
          name: `${bucket.label}  ·  ${bucket.rows.length}`,
          value,
          inline: false,
        });
      }
      if (truncated) {
        embed.addFields({
          name: "\u200B",
          value: `Some buckets were trimmed — see the full sheet on the [team page](${siteTeam}).`,
          inline: false,
        });
      }
    }

    await interaction.editReply({ embeds: [embed] });
  } catch (err) {
    const msg = formatCommandError(err);
    console.error("/team failed:", err);
    await interaction.editReply({ content: `Could not load team: ${msg}` });
  }
}

async function handlePostVerifyCard(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  if (
    !interaction.guild ||
    !interaction.channel?.isTextBased() ||
    !interaction.channel.isSendable()
  ) {
    await interaction.reply({
      flags: MessageFlags.Ephemeral,
      content: "Use this command in a sendable text channel inside the server.",
    });
    return;
  }

  /** Defer first: Discord invalidates the interaction if the first ack takes ~3s+ (10062). */
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
    await interaction.editReply({
      content: "You need **Manage Server** to post the verification card.",
    });
    return;
  }

  const verifyUrl = `${env.VFL_SITE_URL.replace(/\/$/, "")}/verify`;
  const embed = new EmbedBuilder()
    .setColor(0x083696)
    .setTitle("Verify your account")
    .setDescription(
      [
        "New here? **Click below**, then sign in with **Discord** and **Roblox**.",
        "",
        "After that, your nickname will match your Roblox username and staff will review your registration — same process as before, on the VFL site (no third-party verify bot).",
      ].join("\n"),
    )
    .setFooter({ text: "VFL · Website verification" })
    .setTimestamp(new Date());

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setLabel("Click to verify")
      .setStyle(ButtonStyle.Link)
      .setURL(verifyUrl),
  );

  try {
    await interaction.channel.send({ embeds: [embed], components: [row] });
    await interaction.editReply({ content: "Posted." });
  } catch (err) {
    console.error("/postverify: failed to post card:", err);
    await interaction.editReply({
      content: "Could not post the verification card in this channel (check bot Send Messages / Embed Links).",
    });
  }
}

async function handleBacklog(
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
      content: "You need the Manage Roles permission to use /backlog.",
    });
    return;
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const members = await interaction.guild.members.fetch();
  const guildId = interaction.guild.id;

  const pending = Array.from(
    members
      .filter(
        (member) =>
          member.roles.cache.has(env.DISCORD_ROVER_VERIFIED_ROLE_ID) &&
          !member.roles.cache.has(env.DISCORD_APPROVED_ROLE_ID),
      )
      .values(),
  ).sort((a, b) => (a.joinedTimestamp ?? 0) - (b.joinedTimestamp ?? 0));

  const supabase = createBotSupabase();
  const { data: releaseRows, error: releaseErr } = await supabase
    .from("roster_release_requests")
    .select(
      "id, guild_id, channel_id, message_id, requester_discord_id, target_discord_id, team_slug, season, created_at, players:player_id(roblox_username)",
    )
    .eq("guild_id", guildId)
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(50);
  if (releaseErr) {
    console.error("backlog release fetch:", releaseErr);
  }
  type ReleaseBacklogRow = {
    id: string;
    guild_id: string;
    channel_id: string | null;
    message_id: string | null;
    requester_discord_id: string;
    target_discord_id: string;
    team_slug: string;
    season: number;
    created_at: string | null;
    /** Supabase typegen returns embedded FK joins as an array even for many-to-one. */
    players: { roblox_username: string | null }[] | null;
  };
  const releases = (releaseRows ?? []) as unknown as ReleaseBacklogRow[];

  if (pending.length === 0 && releases.length === 0) {
    const embed = new EmbedBuilder()
      .setColor(0x10b981)
      .setTitle("✅ Backlog")
      .setDescription(
        "No pending whitelist requests **and** no pending release requests. All clear.",
      );
    await interaction.editReply({ embeds: [embed] });
    return;
  }

  const cardLinks = await collectReviewCardLinks(interaction);

  const whitelistLines = pending.map((member, idx) => {
    const nick = member.nickname ? ` · nick \`${member.nickname}\`` : "";
    const joined = member.joinedTimestamp
      ? ` · joined <t:${Math.floor(member.joinedTimestamp / 1000)}:R>`
      : "";
    const cardUrl = cardLinks.get(member.id);
    const cardLink = cardUrl ? ` · [📩 review card](${cardUrl})` : "";
    return `**${idx + 1}.** ${member} (\`${member.user.username}\`)${nick}${joined}${cardLink}`;
  });

  const teamNames = await buildTeamNameBySlug(supabase);
  const releaseLines = releases.map((row, idx) => {
    const created = row.created_at
      ? ` · <t:${Math.floor(new Date(row.created_at).getTime() / 1000)}:R>`
      : "";
    const cardUrl =
      row.message_id && row.channel_id
        ? `https://discord.com/channels/${guildId}/${row.channel_id}/${row.message_id}`
        : null;
    const cardLink = cardUrl ? ` · [📩 review card](${cardUrl})` : "";
    const teamLabel = teamNames.get(row.team_slug) ?? row.team_slug;
    const playerName =
      row.players?.[0]?.roblox_username ?? row.target_discord_id;
    return (
      `**${idx + 1}.** \`${playerName}\` · ${teamLabel} (\`${row.team_slug}\`) · S${row.season}` +
      ` · req <@${row.requester_discord_id}>${created}${cardLink}`
    );
  });

  const sections: string[] = [];
  if (pending.length > 0) {
    const visible = whitelistLines.slice(0, 25).join("\n");
    const overflow =
      pending.length > 25 ? `\n…and **${pending.length - 25}** more.` : "";
    sections.push(
      `**🛂 Whitelist · ${pending.length} pending**\n${visible}${overflow}`,
    );
  }
  if (releases.length > 0) {
    const visible = releaseLines.slice(0, 25).join("\n");
    const overflow =
      releases.length > 25 ? `\n…and **${releases.length - 25}** more.` : "";
    sections.push(
      `**📤 Release requests · ${releases.length} pending**\n${visible}${overflow}`,
    );
  }

  const totals = [
    pending.length > 0
      ? `${pending.length} whitelist`
      : null,
    releases.length > 0
      ? `${releases.length} release${releases.length === 1 ? "" : "s"}`
      : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const embed = new EmbedBuilder()
    .setColor(0x083696)
    .setTitle(`📋 Backlog · ${totals}`)
    .setDescription(sections.join("\n\n"))
    .setFooter({
      text: "Tap a review card link to approve or deny.",
    })
    .setTimestamp(new Date());

  await interaction.editReply({ embeds: [embed] });
}

async function handleKick(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  if (!interaction.guild) {
    await interaction.reply({
      flags: MessageFlags.Ephemeral,
      content: "Run this command inside the server.",
    });
    return;
  }
  if (!interaction.memberPermissions?.has(PermissionFlagsBits.KickMembers)) {
    await interaction.reply({
      flags: MessageFlags.Ephemeral,
      content: "You need the Kick Members permission to use /kick.",
    });
    return;
  }

  const user = interaction.options.getUser("user", true);
  const reason =
    interaction.options.getString("reason") ?? "No reason provided";

  if (user.id === interaction.user.id) {
    await interaction.reply({
      flags: MessageFlags.Ephemeral,
      content: "You can't kick yourself.",
    });
    return;
  }
  if (interaction.client.user && user.id === interaction.client.user.id) {
    await interaction.reply({
      flags: MessageFlags.Ephemeral,
      content: "I can't kick myself, no.",
    });
    return;
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  let target: GuildMember | null = null;
  try {
    target = await interaction.guild.members.fetch(user.id);
  } catch {
    target = null;
  }
  if (!target) {
    await interaction.editReply({
      content: `**${user.tag}** isn't in the server.`,
    });
    return;
  }
  if (!target.kickable) {
    await interaction.editReply({
      content: `Can't kick **${user.tag}** — they're above the bot in the role hierarchy or are the server owner.`,
    });
    return;
  }

  let dmDelivered = true;
  try {
    const dm = new EmbedBuilder()
      .setColor(0xef4444)
      .setTitle("👢 You were kicked from VFL")
      .setDescription(`**Reason**\n${reason}`)
      .setFooter({ text: "VFL Bot" })
      .setTimestamp(new Date());
    await target.send({ embeds: [dm] });
  } catch {
    dmDelivered = false;
  }

  try {
    await target.kick(`Kicked by ${interaction.user.tag}: ${reason}`);
  } catch (error) {
    const msg = error instanceof Error ? error.message : "unknown error";
    await interaction.editReply({
      content: `Failed to kick **${user.tag}**: ${msg}`,
    });
    return;
  }

  const result = new EmbedBuilder()
    .setColor(0xef4444)
    .setTitle("👢 Kicked")
    .setDescription(`**${user.tag}** has been kicked from the server.`)
    .addFields(
      { name: "Reason", value: reason, inline: false },
      {
        name: "DM",
        value: dmDelivered ? "Delivered" : "Not delivered (user blocks DMs)",
        inline: false,
      },
    )
    .setFooter({ text: `Kicked by ${interaction.user.tag}` })
    .setTimestamp(new Date());

  await interaction.editReply({ embeds: [result] });
}

async function handleBan(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  if (!interaction.guild) {
    await interaction.reply({
      flags: MessageFlags.Ephemeral,
      content: "Run this command inside the server.",
    });
    return;
  }
  if (!interaction.memberPermissions?.has(PermissionFlagsBits.BanMembers)) {
    await interaction.reply({
      flags: MessageFlags.Ephemeral,
      content: "You need the Ban Members permission to use /ban.",
    });
    return;
  }

  const user = interaction.options.getUser("user", true);
  const reason =
    interaction.options.getString("reason") ?? "No reason provided";
  const deleteDays = interaction.options.getInteger("delete_days") ?? 0;

  if (user.id === interaction.user.id) {
    await interaction.reply({
      flags: MessageFlags.Ephemeral,
      content: "You can't ban yourself.",
    });
    return;
  }
  if (interaction.client.user && user.id === interaction.client.user.id) {
    await interaction.reply({
      flags: MessageFlags.Ephemeral,
      content: "I can't ban myself.",
    });
    return;
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  let target: GuildMember | null = null;
  try {
    target = await interaction.guild.members.fetch(user.id);
  } catch {
    target = null;
  }

  if (target && !target.bannable) {
    await interaction.editReply({
      content: `Can't ban **${user.tag}** — they're above the bot in the role hierarchy or are the server owner.`,
    });
    return;
  }

  let dmDelivered = true;
  if (target) {
    try {
      const dm = new EmbedBuilder()
        .setColor(0x991b1b)
        .setTitle("🔨 You were banned from VFL")
        .setDescription(`**Reason**\n${reason}`)
        .setFooter({ text: "VFL Bot" })
        .setTimestamp(new Date());
      await target.send({ embeds: [dm] });
    } catch {
      dmDelivered = false;
    }
  } else {
    dmDelivered = false;
  }

  try {
    await interaction.guild.members.ban(user.id, {
      deleteMessageSeconds: deleteDays * 86400,
      reason: `Banned by ${interaction.user.tag}: ${reason}`,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "unknown error";
    await interaction.editReply({
      content: `Failed to ban **${user.tag}**: ${msg}`,
    });
    return;
  }

  const result = new EmbedBuilder()
    .setColor(0x991b1b)
    .setTitle("🔨 Banned")
    .setDescription(`**${user.tag}** has been banned from the server.`)
    .addFields(
      { name: "Reason", value: reason, inline: false },
      {
        name: "Messages deleted",
        value:
          deleteDays > 0
            ? `${deleteDays} day${deleteDays === 1 ? "" : "s"} of history`
            : "None",
        inline: true,
      },
      {
        name: "DM",
        value: target
          ? dmDelivered
            ? "Delivered"
            : "Not delivered (user blocks DMs)"
          : "Skipped (user not in server)",
        inline: true,
      },
    )
    .setFooter({ text: `Banned by ${interaction.user.tag}` })
    .setTimestamp(new Date());

  await interaction.editReply({ embeds: [result] });
}

async function handleAppoint(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  if (!interaction.guild) {
    await interaction.reply({
      flags: MessageFlags.Ephemeral,
      content: "Run this command inside the server.",
    });
    return;
  }

  const perms = interaction.memberPermissions;
  const isOwner = interaction.guild.ownerId === interaction.user.id;
  const allowed =
    isOwner ||
    Boolean(
      perms?.has(PermissionFlagsBits.Administrator) ||
        perms?.has(PermissionFlagsBits.ManageGuild),
    );

  if (!allowed) {
    await interaction.reply({
      flags: MessageFlags.Ephemeral,
      content:
        "You need **Manage Server** (or **Administrator**), or be the **server owner**, to use `/appoint`.",
    });
    return;
  }

  const teamRaw = interaction.options.getString("team", true);
  const season = interaction.options.getInteger("season", true);
  const managerDiscordUser = interaction.options.getUser("manager", true);

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  try {
    const supabase = createBotSupabase();
    const teamRows = await loadTeams(supabase);
    const resolved = await resolveTeamForSlashCommand(supabase, teamRows, teamRaw);

    if (!resolved) {
      await interaction.editReply({
        content:
          "Could not resolve that team. Use **team** suggestions or the exact slug (e.g. `algeria`).",
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

    const profile = await findPlayerByDiscordId(supabase, managerDiscordUser.id);
    if (!profile) {
      await interaction.editReply({
        content: `${managerDiscordUser} has no VF **players** row linked to that Discord account. They need to sync / approve first.`,
      });
      return;
    }

    const robloxName = profile.roblox_username?.trim();
    if (!robloxName) {
      await interaction.editReply({
        content: "That VF player record has no **roblox_username** set.",
      });
      return;
    }

    const { error: upsertErr } = await supabase
      .from("team_season_managers")
      .upsert(
        {
          team_slug: resolved.slug,
          season,
          manager_display_name: robloxName,
        },
        { onConflict: "team_slug,season" },
      );

    if (upsertErr) throw upsertErr;

    const roleId = env.DISCORD_TEAM_MANAGER_ROLE_ID;
    let roleLines: string;
    try {
      const targetMember = await interaction.guild.members.fetch(
        managerDiscordUser.id,
      );
      if (targetMember.roles.cache.has(roleId)) {
        roleLines = `**Discord role** · Already had <@&${roleId}>.`;
      } else if (!targetMember.manageable) {
        roleLines =
          "**Discord role** · Could not assign — bot cannot modify this member (role hierarchy / owner). Database was still updated.";
      } else {
        try {
          await targetMember.roles.add(
            roleId,
            `/appoint by ${interaction.user.tag} · ${resolved.slug} S${season}`,
          );
          roleLines = `**Discord role** · Gave <@&${roleId}>.`;
        } catch (roleErr) {
          const r = formatCommandError(roleErr);
          roleLines = `**Discord role** · Failed (${r}). Database was still updated — check bot role position & **Manage Roles**.`;
        }
      }
    } catch {
      roleLines =
        "**Discord role** · Member not in server or fetch failed — database was still updated. Add the role manually if needed.";
    }

    const siteBase = env.VFL_SITE_URL.replace(/\/$/, "");
    const teamUrl = `${siteBase}/teams/${encodeURIComponent(resolved.slug)}?season=${season}`;

    const embed = new EmbedBuilder()
      .setColor(0x10b981)
      .setTitle("Manager appointed")
      .setDescription(
        [
          `**Team** · [${resolved.name}](${teamUrl})`,
          `**Season** · **${season}**`,
          `**Manager (Roblox)** · \`${robloxName}\``,
          `**Discord** · ${managerDiscordUser}`,
          "",
          roleLines,
          "",
          `> Stored in \`team_season_managers\` — site & bot will use this name.`,
        ].join("\n"),
      )
      .setFooter({ text: `By ${interaction.user.tag}` })
      .setTimestamp(new Date());

    await interaction.editReply({ embeds: [embed] });
  } catch (err) {
    const msg = formatCommandError(err);
    console.error("/appoint failed:", err);
    await interaction.editReply({
      content: `Could not save manager: ${msg}`,
    });
  }
}

async function collectReviewCardLinks(
  interaction: ChatInputCommandInteraction,
): Promise<Map<string, string>> {
  const links = new Map<string, string>();
  if (!interaction.guild) return links;

  let channel: GuildBasedChannel | null;
  try {
    channel = await interaction.guild.channels.fetch(
      env.DISCORD_STAFF_REVIEW_CHANNEL_ID,
    );
  } catch {
    return links;
  }

  if (!channel || !channel.isTextBased()) return links;

  let messages;
  try {
    messages = await (channel as GuildTextBasedChannel).messages.fetch({
      limit: 100,
    });
  } catch {
    return links;
  }

  // Messages come back newest first — first hit per memberId wins.
  for (const message of messages.values()) {
    for (const row of message.components ?? []) {
      if (row.type !== ComponentType.ActionRow) continue;
      for (const component of row.components) {
        if (component.type !== ComponentType.Button) continue;
        const customId = component.customId;
        if (!customId) continue;
        let memberId: string | null = null;
        if (customId.startsWith(APPROVE_BUTTON_ID_PREFIX)) {
          memberId = customId.slice(APPROVE_BUTTON_ID_PREFIX.length);
        } else if (customId.startsWith(DENY_BUTTON_ID_PREFIX)) {
          memberId = customId.slice(DENY_BUTTON_ID_PREFIX.length);
        }
        if (memberId && !links.has(memberId)) {
          links.set(memberId, message.url);
        }
      }
    }
  }

  return links;
}
