import {
  ComponentType,
  EmbedBuilder,
  type Guild,
  type GuildTextBasedChannel,
  type Message,
} from "discord.js";

import { env } from "@/bot/config";
import { CONTRACT_BTN_APPROVE, CONTRACT_BTN_DENY } from "@/bot/contracts";
import { RELEASE_BTN_APPROVE, RELEASE_BTN_DENY } from "@/bot/release";
import { buildTeamNameBySlug, createBotSupabase } from "@/bot/stats-queries";
import { APPROVE_BUTTON_ID_PREFIX, DENY_BUTTON_ID_PREFIX } from "@/bot/sync";
import {
  CREATOR_APPROVE_PREFIX,
  CREATOR_POST_REMOVE_APPROVE_PREFIX,
  CREATOR_REJECT_PREFIX,
} from "@/lib/creator-onboard/creator-discord-constants";
import {
  MEDIA_STAFF_APPROVE_PREFIX,
  MEDIA_STAFF_REJECT_PREFIX,
} from "@/lib/media-staff/media-discord-constants";

const MAX_LINES = 20;

type ButtonIndex = Map<string, string>;

function dedupePostRemoves(
  items: ChannelScan["postRemoves"],
): ChannelScan["postRemoves"] {
  const seen = new Set<string>();
  const out: ChannelScan["postRemoves"] = [];
  for (const item of items) {
    if (seen.has(item.applicationId)) continue;
    seen.add(item.applicationId);
    out.push(item);
  }
  return out;
}

type ChannelScan = {
  whitelist: ButtonIndex;
  creatorApps: ButtonIndex;
  mediaStaff: ButtonIndex;
  contracts: ButtonIndex;
  releases: ButtonIndex;
  postRemoves: { applicationId: string; url: string; hint: string }[];
};

function messageHasActiveApproveButton(
  message: Message,
  approvePrefix: string,
  denyPrefix?: string,
): string | null {
  for (const row of message.components) {
    if (row.type !== ComponentType.ActionRow) continue;
    for (const component of row.components) {
      if (component.type !== ComponentType.Button) continue;
      const customId = component.customId;
      if (!customId) continue;
      if (customId.startsWith(approvePrefix)) {
        return customId.slice(approvePrefix.length);
      }
      if (denyPrefix && customId.startsWith(denyPrefix)) {
        return customId.slice(denyPrefix.length);
      }
    }
  }
  return null;
}

function indexMessageButtons(message: Message, scan: ChannelScan): void {
  const url = message.url;

  const whitelistKey = messageHasActiveApproveButton(
    message,
    APPROVE_BUTTON_ID_PREFIX,
    DENY_BUTTON_ID_PREFIX,
  );
  if (whitelistKey && !scan.whitelist.has(whitelistKey)) {
    scan.whitelist.set(whitelistKey, url);
  }

  const creatorKey = messageHasActiveApproveButton(
    message,
    CREATOR_APPROVE_PREFIX,
    CREATOR_REJECT_PREFIX,
  );
  if (creatorKey && !scan.creatorApps.has(creatorKey)) {
    scan.creatorApps.set(creatorKey, url);
  }

  const mediaKey = messageHasActiveApproveButton(
    message,
    MEDIA_STAFF_APPROVE_PREFIX,
    MEDIA_STAFF_REJECT_PREFIX,
  );
  if (mediaKey && !scan.mediaStaff.has(mediaKey)) {
    scan.mediaStaff.set(mediaKey, url);
  }

  const contractKey = messageHasActiveApproveButton(
    message,
    CONTRACT_BTN_APPROVE,
    CONTRACT_BTN_DENY,
  );
  if (contractKey && !scan.contracts.has(contractKey)) {
    scan.contracts.set(contractKey, url);
  }

  const releaseKey = messageHasActiveApproveButton(
    message,
    RELEASE_BTN_APPROVE,
    RELEASE_BTN_DENY,
  );
  if (releaseKey && !scan.releases.has(releaseKey)) {
    scan.releases.set(releaseKey, url);
  }

  const postRemoveKey = messageHasActiveApproveButton(
    message,
    CREATOR_POST_REMOVE_APPROVE_PREFIX,
  );
  if (postRemoveKey) {
    const embed = message.embeds[0];
    const hint =
      embed?.description?.split("\n").find((l) => l.startsWith("http")) ??
      embed?.title ??
      postRemoveKey;
    const short =
      hint.length > 72 ? `${hint.slice(0, 69)}…` : hint;
    if (!scan.postRemoves.some((p) => p.applicationId === postRemoveKey)) {
      scan.postRemoves.push({
        applicationId: postRemoveKey,
        url,
        hint: short,
      });
    }
  }
}

async function scanApprovalChannel(
  guild: Guild,
  channelId: string | undefined,
): Promise<ChannelScan> {
  const empty: ChannelScan = {
    whitelist: new Map(),
    creatorApps: new Map(),
    mediaStaff: new Map(),
    contracts: new Map(),
    releases: new Map(),
    postRemoves: [],
  };
  if (!channelId?.trim()) return empty;

  let channel;
  try {
    channel = await guild.channels.fetch(channelId.trim());
  } catch {
    return empty;
  }
  if (!channel?.isTextBased()) return empty;

  let messages;
  try {
    messages = await (channel as GuildTextBasedChannel).messages.fetch({
      limit: 100,
    });
  } catch {
    return empty;
  }

  for (const message of messages.values()) {
    indexMessageButtons(message, empty);
  }
  return empty;
}

function discordMessageUrl(
  guildId: string,
  channelId: string | null | undefined,
  messageId: string | null | undefined,
): string | null {
  if (!channelId?.trim() || !messageId?.trim()) return null;
  return `https://discord.com/channels/${guildId}/${channelId.trim()}/${messageId.trim()}`;
}

function cardLink(url: string | null | undefined): string {
  return url ? ` · [review card](${url})` : "";
}

function formatSection(
  emoji: string,
  title: string,
  lines: string[],
): string | null {
  if (lines.length === 0) return null;
  const visible = lines.slice(0, MAX_LINES).join("\n");
  const overflow =
    lines.length > MAX_LINES
      ? `\n…and **${lines.length - MAX_LINES}** more.`
      : "";
  return `**${emoji} ${title} · ${lines.length} pending**\n${visible}${overflow}`;
}

export async function buildBacklogEmbed(guild: Guild): Promise<EmbedBuilder> {
  const guildId = guild.id;
  const supabase = createBotSupabase();

  const [staffScan, creatorScan, teamNames] = await Promise.all([
    scanApprovalChannel(guild, env.DISCORD_STAFF_REVIEW_CHANNEL_ID),
    scanApprovalChannel(guild, env.DISCORD_CREATOR_APPROVAL_CHANNEL_ID),
    buildTeamNameBySlug(supabase),
  ]);

  const channelScan: ChannelScan = {
    whitelist: new Map([...staffScan.whitelist, ...creatorScan.whitelist]),
    creatorApps: new Map([
      ...staffScan.creatorApps,
      ...creatorScan.creatorApps,
    ]),
    mediaStaff: new Map([
      ...staffScan.mediaStaff,
      ...creatorScan.mediaStaff,
    ]),
    contracts: new Map([...staffScan.contracts, ...creatorScan.contracts]),
    releases: new Map([...staffScan.releases, ...creatorScan.releases]),
    postRemoves: dedupePostRemoves([
      ...staffScan.postRemoves,
      ...creatorScan.postRemoves,
    ]),
  };

  const members = await guild.members.fetch();
  const whitelistPending = Array.from(
    members
      .filter(
        (member) =>
          member.roles.cache.has(env.DISCORD_ROVER_VERIFIED_ROLE_ID) &&
          !member.roles.cache.has(env.DISCORD_APPROVED_ROLE_ID),
      )
      .values(),
  ).sort((a, b) => (a.joinedTimestamp ?? 0) - (b.joinedTimestamp ?? 0));

  const [
    { data: releaseRows, error: releaseErr },
    { data: creatorRows, error: creatorErr },
    { data: contractRows, error: contractErr },
  ] = await Promise.all([
    supabase
      .from("roster_release_requests")
      .select(
        "id, guild_id, channel_id, message_id, requester_discord_id, target_discord_id, team_slug, season, created_at, players:player_id(roblox_username)",
      )
      .eq("guild_id", guildId)
      .eq("status", "pending")
      .order("created_at", { ascending: true })
      .limit(50),
    supabase
      .from("creator_applications")
      .select("id, discord_id, discord_username, roblox_username, created_at")
      .eq("status", "pending")
      .order("created_at", { ascending: true })
      .limit(50),
    supabase
      .from("contract_offers")
      .select(
        "id, guild_id, channel_id, message_id, contractor_discord_id, signee_discord_id, team_slug, season, roster_position, roster_role, created_at, players:signee_player_id(roblox_username)",
      )
      .eq("guild_id", guildId)
      .eq("status", "pending")
      .order("created_at", { ascending: true })
      .limit(50),
  ]);

  if (releaseErr) console.error("backlog release fetch:", releaseErr);
  if (creatorErr) console.error("backlog creator fetch:", creatorErr);
  if (contractErr) console.error("backlog contract fetch:", contractErr);

  type ReleaseRow = {
    id: string;
    channel_id: string | null;
    message_id: string | null;
    requester_discord_id: string;
    target_discord_id: string;
    team_slug: string;
    season: number;
    created_at: string | null;
    players: { roblox_username: string | null }[] | null;
  };
  type CreatorRow = {
    id: string;
    discord_id: string;
    discord_username: string | null;
    roblox_username: string;
    created_at: string;
  };
  type ContractRow = {
    id: string;
    channel_id: string | null;
    message_id: string | null;
    contractor_discord_id: string;
    signee_discord_id: string;
    team_slug: string;
    season: number;
    roster_position: string;
    roster_role: string;
    created_at: string;
    players: { roblox_username: string | null }[] | null;
  };

  const releases = (releaseRows ?? []) as unknown as ReleaseRow[];
  const creators = (creatorRows ?? []) as unknown as CreatorRow[];
  const contracts = (contractRows ?? []) as unknown as ContractRow[];

  const whitelistLines = whitelistPending.map((member, idx) => {
    const nick = member.nickname ? ` · nick \`${member.nickname}\`` : "";
    const joined = member.joinedTimestamp
      ? ` · <t:${Math.floor(member.joinedTimestamp / 1000)}:R>`
      : "";
    const cardUrl = channelScan.whitelist.get(member.id);
    return `**${idx + 1}.** ${member} (\`${member.user.username}\`)${nick}${joined}${cardLink(cardUrl)}`;
  });

  const releaseLines = releases.map((row, idx) => {
    const created = row.created_at
      ? ` · <t:${Math.floor(new Date(row.created_at).getTime() / 1000)}:R>`
      : "";
    const cardUrl =
      discordMessageUrl(guildId, row.channel_id, row.message_id) ??
      channelScan.releases.get(row.id) ??
      null;
    const teamLabel = teamNames.get(row.team_slug) ?? row.team_slug;
    const playerName =
      row.players?.[0]?.roblox_username ?? row.target_discord_id;
    return (
      `**${idx + 1}.** \`${playerName}\` · ${teamLabel} · S${row.season}` +
      ` · req <@${row.requester_discord_id}>${created}${cardLink(cardUrl)}`
    );
  });

  const pendingCreatorIds = new Set(creators.map((c) => c.id));
  const creatorLines = creators.map((row, idx) => {
    const created = row.created_at
      ? ` · <t:${Math.floor(new Date(row.created_at).getTime() / 1000)}:R>`
      : "";
    const user =
      row.discord_username?.trim() || row.discord_id;
    const cardUrl = channelScan.creatorApps.get(row.id) ?? null;
    return (
      `**${idx + 1}.** <@${row.discord_id}> (\`${user}\`) · Roblox \`${row.roblox_username}\`${created}${cardLink(cardUrl)}`
    );
  });
  for (const [appId, cardUrl] of channelScan.creatorApps) {
    if (pendingCreatorIds.has(appId)) continue;
    creatorLines.push(
      `**?** Stale card · app \`${appId.slice(0, 8)}…\`${cardLink(cardUrl)}`,
    );
  }

  const pendingContractIds = new Set(contracts.map((c) => c.id));
  const contractLines = contracts.map((row, idx) => {
    const created = row.created_at
      ? ` · <t:${Math.floor(new Date(row.created_at).getTime() / 1000)}:R>`
      : "";
    const cardUrl =
      discordMessageUrl(guildId, row.channel_id, row.message_id) ??
      channelScan.contracts.get(row.id) ??
      null;
    const teamLabel = teamNames.get(row.team_slug) ?? row.team_slug;
    const playerName =
      row.players?.[0]?.roblox_username ?? row.signee_discord_id;
    return (
      `**${idx + 1}.** \`${playerName}\` · ${teamLabel} · ${row.roster_position}/${row.roster_role}` +
      ` · signee <@${row.signee_discord_id}>${created}${cardLink(cardUrl)}`
    );
  });
  for (const [offerId, cardUrl] of channelScan.contracts) {
    if (pendingContractIds.has(offerId)) continue;
    contractLines.push(
      `**?** Stale card · offer \`${offerId.slice(0, 8)}…\`${cardLink(cardUrl)}`,
    );
  }

  const mediaLines = Array.from(channelScan.mediaStaff.entries()).map(
    ([discordUserId, cardUrl], idx) =>
      `**${idx + 1}.** <@${discordUserId}>${cardLink(cardUrl)}`,
  );

  const postRemoveLines = channelScan.postRemoves.map((row, idx) => {
    return `**${idx + 1}.** app \`${row.applicationId.slice(0, 8)}…\` · ${row.hint}${cardLink(row.url)}`;
  });

  const sections = [
    formatSection("🛂", "Whitelist", whitelistLines),
    formatSection("🎬", "VF Create applications", creatorLines),
    formatSection("📺", "Media staff (Discord only)", mediaLines),
    formatSection("🗑️", "VF Create post removals", postRemoveLines),
    formatSection("📤", "Roster releases", releaseLines),
    formatSection("📝", "Contract offers (signee)", contractLines),
  ].filter((s): s is string => Boolean(s));

  const counts = [
    whitelistPending.length > 0
      ? `${whitelistPending.length} whitelist`
      : null,
    creators.length > 0 ? `${creators.length} creator` : null,
    mediaLines.length > 0 ? `${mediaLines.length} media` : null,
    postRemoveLines.length > 0
      ? `${postRemoveLines.length} post removal`
      : null,
    releases.length > 0 ? `${releases.length} release` : null,
    contracts.length > 0 ? `${contracts.length} contract` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  if (sections.length === 0) {
    return new EmbedBuilder()
      .setColor(0x10b981)
      .setTitle("✅ Backlog")
      .setDescription(
        "No pending staff approvals across whitelist, VF Create, media staff, releases, contracts, or post removals.",
      )
      .setTimestamp(new Date());
  }

  let description = sections.join("\n\n");
  if (description.length > 4000) {
    description = `${description.slice(0, 3990)}…`;
  }

  return new EmbedBuilder()
    .setColor(0x083696)
    .setTitle(`📋 Backlog · ${counts}`)
    .setDescription(description)
    .setFooter({
      text: "Open review cards to approve or deny. Contract rows need the signee on the card.",
    })
    .setTimestamp(new Date());
}
