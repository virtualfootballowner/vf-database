import type { SupabaseClient } from "@supabase/supabase-js";
import {
  EmbedBuilder,
  MessageFlags,
  type ChatInputCommandInteraction,
  type Client,
  type GuildTextBasedChannel,
} from "discord.js";

import { env } from "@/bot/config";
import { fetchTeamLogoUrl } from "@/bot/site-assets";
import {
  buildTeamNameBySlug,
  createBotSupabase,
  findPlayerByDiscordId,
  resolveManagerTeamSlugForSeason,
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

  const embed = new EmbedBuilder()
    .setColor(0x10b981)
    .setAuthor({ name: "Free agent", url: profileUrl })
    .setTitle(profile.roblox_username)
    .setURL(profileUrl)
    .setDescription(`${interaction.user} is **available**.`)
    .addFields(
      { name: "Position", value: `**${position}**`, inline: true },
      { name: "Discord", value: `${interaction.user}`, inline: true },
      {
        name: "Profile",
        value: `[${profile.roblox_username}](${profileUrl})`,
        inline: false,
      },
    )
    .setFooter({ text: `Cooldown · ${FREE_AGENT_COOLDOWN_HOURS}h between posts` })
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

async function ensureManagerTeam(
  interaction: ChatInputCommandInteraction,
  supabase: SupabaseClient,
): Promise<{ ok: true; teamSlug: string } | null> {
  const activeSeason = env.VF_ACTIVE_ROSTER_SEASON;
  const result = await resolveManagerTeamSlugForSeason(
    supabase,
    interaction.user.id,
    activeSeason,
  );
  if (result.ok) return { ok: true, teamSlug: result.teamSlug };

  const why =
    result.reason === "no_player"
      ? "You need a verified VF profile linked to your Discord."
      : result.reason === "no_username"
        ? "Your VF player record has no Roblox username on file."
        : result.reason === "ambiguous"
          ? "You manage more than one team this season — staff need to fix `team_season_managers`."
          : `You aren’t listed as a manager for **S${activeSeason}**. Ask staff to /appoint you.`;

  await interaction.editReply({ content: why });
  return null;
}

export async function handleFriendly(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  const time = interaction.options.getString("time", true).trim().slice(0, 200);
  const notes = interaction.options.getString("notes")?.trim().slice(0, 500) ?? null;
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const supabase = createBotSupabase();
  const team = await ensureManagerTeam(interaction, supabase);
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

  const teamNames = await buildTeamNameBySlug(supabase);
  const siteBase = env.VFL_SITE_URL.replace(/\/$/, "");
  const teamLabel = teamNames.get(team.teamSlug) ?? team.teamSlug;
  const teamUrl = `${siteBase}/teams/${encodeURIComponent(team.teamSlug)}?season=${env.VF_ACTIVE_ROSTER_SEASON}`;
  const logoUrl = await fetchTeamLogoUrl(supabase, team.teamSlug, siteBase);

  const embed = new EmbedBuilder()
    .setColor(0x083696)
    .setAuthor({
      name: teamLabel,
      iconURL: logoUrl ?? undefined,
      url: teamUrl,
    })
    .setTitle("Friendly request")
    .setDescription(
      `${interaction.user} wants a friendly. DM to set it up.`,
    )
    .addFields(
      { name: "Time", value: `**${time}**`, inline: false },
      { name: "Manager", value: `${interaction.user}`, inline: true },
      {
        name: "Team",
        value: `[${teamLabel}](${teamUrl})\n\`${team.teamSlug}\``,
        inline: true,
      },
    )
    .setFooter({ text: `Season ${env.VF_ACTIVE_ROSTER_SEASON} · VF League` })
    .setTimestamp(new Date());

  if (logoUrl) embed.setThumbnail(logoUrl);
  if (notes) embed.addFields({ name: "Notes", value: notes, inline: false });

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
  const position = interaction.options.getString("position", true);
  const count = interaction.options.getInteger("count", true);
  const notes = interaction.options.getString("notes")?.trim().slice(0, 500) ?? null;
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const supabase = createBotSupabase();
  const team = await ensureManagerTeam(interaction, supabase);
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

  const teamNames = await buildTeamNameBySlug(supabase);
  const siteBase = env.VFL_SITE_URL.replace(/\/$/, "");
  const teamLabel = teamNames.get(team.teamSlug) ?? team.teamSlug;
  const teamUrl = `${siteBase}/teams/${encodeURIComponent(team.teamSlug)}?season=${env.VF_ACTIVE_ROSTER_SEASON}`;
  const logoUrl = await fetchTeamLogoUrl(supabase, team.teamSlug, siteBase);

  const embed = new EmbedBuilder()
    .setColor(0xb45309)
    .setAuthor({
      name: teamLabel,
      iconURL: logoUrl ?? undefined,
      url: teamUrl,
    })
    .setTitle("Scouting · open trial")
    .setDescription(
      `${interaction.user} is recruiting. DM to apply.`,
    )
    .addFields(
      { name: "Position", value: `**${position}**`, inline: true },
      { name: "Slots", value: `**${count}**`, inline: true },
      {
        name: "Team",
        value: `[${teamLabel}](${teamUrl})\n\`${team.teamSlug}\``,
        inline: false,
      },
      { name: "Manager", value: `${interaction.user}`, inline: false },
    )
    .setFooter({ text: `Season ${env.VF_ACTIVE_ROSTER_SEASON} · VF League` })
    .setTimestamp(new Date());

  if (logoUrl) embed.setThumbnail(logoUrl);
  if (notes) embed.addFields({ name: "Notes", value: notes, inline: false });

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
