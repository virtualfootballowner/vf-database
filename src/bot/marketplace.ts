import type { SupabaseClient } from "@supabase/supabase-js";
import {
  EmbedBuilder,
  MessageFlags,
  type ChatInputCommandInteraction,
  type Client,
  type GuildMember,
  type GuildTextBasedChannel,
} from "discord.js";

import { env } from "@/bot/config";
import { absoluteSiteAssetUrl, fetchTeamLogoUrl } from "@/bot/site-assets";
import {
  createBotSupabase,
  findPlayerByDiscordId,
  loadTeams,
  resolveTeamForSlashCommand,
  type TeamRow,
} from "@/bot/stats-queries";
import { getRobloxHeadshotsForBot } from "@/lib/roblox";

/**
 * Channel routing for the player‑marketplace commands. Hard‑coded per the league spec;
 * change here if a channel is moved.
 */
export const MARKETPLACE_CHANNELS = {
  freeAgent: "1499182144449417307",
  friendlyFinder: "1499182170819002458",
  scouting: "1499182115852521553",
} as const;

export const FREE_AGENT_COOLDOWN_HOURS = 6;

/**
 * Per‑user, per‑command cooldown stored in `command_cooldowns`. Returns the moment the
 * existing cooldown clears (Date) when the user is still on cooldown, or `null` when free
 * to act. Writing the new expiry happens via {@link setCommandCooldown}.
 */
export async function getCommandCooldownExpiry(
  supabase: SupabaseClient,
  command: string,
  userId: string,
): Promise<Date | null> {
  const { data, error } = await supabase
    .from("command_cooldowns")
    .select("expires_at")
    .eq("command", command)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;

  const raw = (data as { expires_at?: string } | null)?.expires_at;
  if (!raw) return null;
  const at = new Date(raw);
  if (Number.isNaN(at.getTime())) return null;
  return at.getTime() > Date.now() ? at : null;
}

export async function setCommandCooldown(
  supabase: SupabaseClient,
  command: string,
  userId: string,
  durationMs: number,
): Promise<void> {
  const expiresAt = new Date(Date.now() + durationMs).toISOString();
  const { error } = await supabase
    .from("command_cooldowns")
    .upsert(
      { command, user_id: userId, expires_at: expiresAt },
      { onConflict: "command,user_id" },
    );
  if (error) throw error;
}

async function resolveSendableChannel(
  client: Client,
  channelId: string,
): Promise<GuildTextBasedChannel | null> {
  let channel;
  try {
    channel = await client.channels.fetch(channelId);
  } catch {
    return null;
  }
  if (!channel || !channel.isTextBased()) return null;
  if (!("isSendable" in channel) || !channel.isSendable()) return null;
  return channel as GuildTextBasedChannel;
}

/**
 * Look up a team's display name and logo with the same catalog fallback the
 * site uses (some clubs/nations only live in the in-repo catalog, not the DB).
 */
async function resolveTeamForEmbed(
  supabase: SupabaseClient,
  teamSlug: string,
  siteBase: string,
): Promise<{ name: string; logoUrl: string | null }> {
  const [dbLogo, teams] = await Promise.all([
    fetchTeamLogoUrl(supabase, teamSlug, siteBase),
    loadTeams(supabase),
  ]);
  const fromCatalog: TeamRow | undefined = teams.find(
    (t) => t.slug?.trim() === teamSlug,
  );
  const name = fromCatalog?.name ?? teamSlug;
  const logoUrl =
    dbLogo ?? absoluteSiteAssetUrl(fromCatalog?.logo_url ?? null, siteBase);
  return { name, logoUrl };
}

const COLOR_FREE_AGENT = 0x10b981;
const COLOR_FRIENDLY = 0x083696;
const COLOR_SCOUTING = 0xb45309;

export async function handleFreeAgent(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  const position = interaction.options.getString("position", true);
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const supabase = createBotSupabase();

  const cooldownUntil = await getCommandCooldownExpiry(
    supabase,
    "freeagent",
    interaction.user.id,
  );
  if (cooldownUntil) {
    await interaction.editReply({
      content: `You can post in free agency again <t:${Math.floor(cooldownUntil.getTime() / 1000)}:R>.`,
    });
    return;
  }

  const profile = await findPlayerByDiscordId(supabase, interaction.user.id);
  if (!profile?.roblox_user_id) {
    await interaction.editReply({
      content:
        "You don’t have a linked VF profile yet. Verify on the website first so we can fetch your Roblox profile.",
    });
    return;
  }

  const channel = await resolveSendableChannel(
    interaction.client,
    MARKETPLACE_CHANNELS.freeAgent,
  );
  if (!channel) {
    await interaction.editReply({
      content: "Free‑agent channel is not reachable. Tell staff.",
    });
    return;
  }

  const headshots = await getRobloxHeadshotsForBot(
    [profile.roblox_user_id],
    "420x420",
  );
  const headshot = headshots.get(profile.roblox_user_id) ?? null;

  const siteBase = env.VFL_SITE_URL.replace(/\/$/, "");
  const profileUrl = `${siteBase}/players/${encodeURIComponent(profile.roblox_username)}`;
  const robloxProfile = `https://www.roblox.com/users/${profile.roblox_user_id}/profile`;

  const description = [
    `### Available now`,
    `**${interaction.user}** is open to offers — DM to make one.`,
    "",
    `> **Position** · **${position}**`,
    `> **Roblox** · [${profile.roblox_username}](${robloxProfile})`,
    `> **VFL profile** · [open](${profileUrl})`,
  ].join("\n");

  const embed = new EmbedBuilder()
    .setColor(COLOR_FREE_AGENT)
    .setAuthor({ name: "Free agent · VF League", url: profileUrl })
    .setTitle(profile.roblox_username)
    .setURL(profileUrl)
    .setDescription(description)
    .setFooter({
      text: `One free-agent post every ${FREE_AGENT_COOLDOWN_HOURS}h · VFL`,
    })
    .setTimestamp(new Date());

  if (headshot) embed.setThumbnail(headshot);

  let posted;
  try {
    posted = await channel.send({ embeds: [embed] });
  } catch (err) {
    console.error("/freeagent send failed:", err);
    await interaction.editReply({
      content:
        "Could not post to the free‑agent channel — the bot may be missing permissions there.",
    });
    return;
  }

  await setCommandCooldown(
    supabase,
    "freeagent",
    interaction.user.id,
    FREE_AGENT_COOLDOWN_HOURS * 60 * 60 * 1000,
  );

  await interaction.editReply({
    content: `Posted in <#${channel.id}>: ${posted.url}`,
  });
}

/**
 * Gate club-manager marketplace commands on the Discord role alone — anyone with the
 * configured manager role can use them. We avoid the `team_season_managers` lookup so
 * managers who haven't been formally appointed in the DB can still post (they pick the
 * team via autocomplete on the command).
 */
function ensureManagerRole(
  interaction: ChatInputCommandInteraction,
): boolean {
  if (!interaction.member) return false;
  const member = interaction.member as GuildMember;
  return member.roles.cache.has(env.DISCORD_TEAM_MANAGER_ROLE_ID);
}

async function resolveTeamFromOption(
  interaction: ChatInputCommandInteraction,
  supabase: SupabaseClient,
): Promise<{ slug: string; name: string; logo: string | null } | null> {
  const teamRaw = interaction.options.getString("team", true);
  const teams = await loadTeams(supabase);
  const resolved = await resolveTeamForSlashCommand(supabase, teams, teamRaw);
  if (!resolved) {
    await interaction.editReply({
      content:
        "Could not resolve that club. Use **team** suggestions or type the exact slug.",
    });
    return null;
  }
  return {
    slug: resolved.slug,
    name: resolved.name,
    logo: resolved.logo_url,
  };
}

export async function handleFriendly(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  if (!ensureManagerRole(interaction)) {
    await interaction.reply({
      flags: MessageFlags.Ephemeral,
      content:
        "You need the **club manager** role to post in the friendly finder.",
    });
    return;
  }
  const time = interaction.options.getString("time", true).trim().slice(0, 200);
  const notes = interaction.options.getString("notes")?.trim().slice(0, 500) ?? null;
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const supabase = createBotSupabase();
  const team = await resolveTeamFromOption(interaction, supabase);
  if (!team) return;

  const channel = await resolveSendableChannel(
    interaction.client,
    MARKETPLACE_CHANNELS.friendlyFinder,
  );
  if (!channel) {
    await interaction.editReply({
      content: "Friendly‑finder channel is not reachable. Tell staff.",
    });
    return;
  }

  const siteBase = env.VFL_SITE_URL.replace(/\/$/, "");
  const teamUrl = `${siteBase}/teams/${encodeURIComponent(team.slug)}?season=${env.VF_ACTIVE_ROSTER_SEASON}`;
  const { name: teamLabel, logoUrl } = await resolveTeamForEmbed(
    supabase,
    team.slug,
    siteBase,
  );

  const description = [
    `### Looking for a friendly`,
    `${interaction.user} wants to play — DM to lock it in.`,
    "",
    `> **When** · **${time}**`,
    `> **Team** · [${teamLabel}](${teamUrl})`,
    notes ? `> **Notes** · ${notes}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  const embed = new EmbedBuilder()
    .setColor(COLOR_FRIENDLY)
    .setAuthor({
      name: `${teamLabel} · VF League`,
      iconURL: logoUrl ?? undefined,
      url: teamUrl,
    })
    .setTitle("Friendly request")
    .setURL(teamUrl)
    .setDescription(description)
    .setFooter({ text: `Season ${env.VF_ACTIVE_ROSTER_SEASON} · VFL · Friendly finder` })
    .setTimestamp(new Date());

  if (logoUrl) embed.setThumbnail(logoUrl);

  let posted;
  try {
    posted = await channel.send({ embeds: [embed] });
  } catch (err) {
    console.error("/friendly send failed:", err);
    await interaction.editReply({
      content:
        "Could not post to the friendly‑finder channel — the bot may be missing permissions there.",
    });
    return;
  }

  await interaction.editReply({
    content: `Posted in <#${channel.id}>: ${posted.url}`,
  });
}

export async function handleScouting(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  if (!ensureManagerRole(interaction)) {
    await interaction.reply({
      flags: MessageFlags.Ephemeral,
      content:
        "You need the **club manager** role to post a scouting trial.",
    });
    return;
  }
  const position = interaction.options.getString("position", true);
  const count = interaction.options.getInteger("count", true);
  const notes = interaction.options.getString("notes")?.trim().slice(0, 500) ?? null;
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const supabase = createBotSupabase();
  const team = await resolveTeamFromOption(interaction, supabase);
  if (!team) return;

  const channel = await resolveSendableChannel(
    interaction.client,
    MARKETPLACE_CHANNELS.scouting,
  );
  if (!channel) {
    await interaction.editReply({
      content: "Scouting channel is not reachable. Tell staff.",
    });
    return;
  }

  const siteBase = env.VFL_SITE_URL.replace(/\/$/, "");
  const teamUrl = `${siteBase}/teams/${encodeURIComponent(team.slug)}?season=${env.VF_ACTIVE_ROSTER_SEASON}`;
  const { name: teamLabel, logoUrl } = await resolveTeamForEmbed(
    supabase,
    team.slug,
    siteBase,
  );

  const slotsLabel = count === 1 ? "slot" : "slots";
  const description = [
    `### Recruiting · ${count} ${slotsLabel} open`,
    `${interaction.user} is signing **${position}** for ${teamLabel} — DM to trial.`,
    "",
    `> **Position** · **${position}**`,
    `> **Slots** · **${count}**`,
    `> **Team** · [${teamLabel}](${teamUrl})`,
    notes ? `> **Notes** · ${notes}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  const embed = new EmbedBuilder()
    .setColor(COLOR_SCOUTING)
    .setAuthor({
      name: `${teamLabel} · VF League`,
      iconURL: logoUrl ?? undefined,
      url: teamUrl,
    })
    .setTitle("Scouting · open trial")
    .setURL(teamUrl)
    .setDescription(description)
    .setFooter({ text: `Season ${env.VF_ACTIVE_ROSTER_SEASON} · VFL · Scouting` })
    .setTimestamp(new Date());

  if (logoUrl) embed.setThumbnail(logoUrl);

  let posted;
  try {
    posted = await channel.send({ embeds: [embed] });
  } catch (err) {
    console.error("/scouting send failed:", err);
    await interaction.editReply({
      content:
        "Could not post to the scouting channel — the bot may be missing permissions there.",
    });
    return;
  }

  await interaction.editReply({
    content: `Posted in <#${channel.id}>: ${posted.url}`,
  });
}
