import {
  AttachmentBuilder,
  EmbedBuilder,
  type Client,
  type Message,
  type TextChannel,
} from "discord.js";

import { isMediaGuild, leagueGuildId } from "@/bot/referees/config";

/** Media-server channels whose messages mirror into the league server. */
const DEFAULT_MEDIA_FORWARD_SOURCE_CHANNEL_IDS = [
  "1504012980533330000",
  "1503664568008835162",
  "1509902741781086410",
  "1504734192523542618",
  "1503909817184682125",
  "1508180455080329246",
  "1508610855397232742",
  "1508566619721433178",
  "1507797296438575194",
  "1508494285987778750",
  "1507792663993385050",
  "1509842800815116288",
] as const;

const DEFAULT_MEDIA_FORWARD_DEST_CHANNEL_ID = "1486459530370879702";

function parseChannelIdList(raw: string | undefined): Set<string> {
  if (!raw?.trim()) return new Set();
  return new Set(
    raw
      .split(/[,\s]+/)
      .map((s) => s.trim())
      .filter(Boolean),
  );
}

export function mediaForwardSourceChannelIds(): Set<string> {
  const fromEnv = parseChannelIdList(
    process.env.DISCORD_MEDIA_FORWARD_SOURCE_CHANNEL_IDS,
  );
  if (fromEnv.size > 0) return fromEnv;
  return new Set(DEFAULT_MEDIA_FORWARD_SOURCE_CHANNEL_IDS);
}

export function mediaForwardDestChannelId(): string {
  const raw = process.env.DISCORD_MEDIA_FORWARD_DEST_CHANNEL_ID?.trim();
  return raw && raw.length > 0
    ? raw
    : DEFAULT_MEDIA_FORWARD_DEST_CHANNEL_ID;
}

export function logMediaForwardConfigAtStartup(): void {
  console.log(
    `[media-forward] ${mediaForwardSourceChannelIds().size} source channel(s) → league ${mediaForwardDestChannelId()}`,
  );
}

function isTextChannel(message: Message): message is Message & {
  channel: TextChannel;
} {
  return message.channel.isTextBased() && !message.channel.isDMBased();
}

function hasForwardablePayload(message: Message): boolean {
  return (
    (message.content?.trim().length ?? 0) > 0 ||
    message.embeds.length > 0 ||
    message.attachments.size > 0 ||
    message.stickers.size > 0
  );
}

function buildForwardHeader(message: Message): string {
  const channelLabel =
    "name" in message.channel && message.channel.name
      ? `#${message.channel.name}`
      : "media";
  const author = message.author?.bot
    ? message.author.username
    : `<@${message.author.id}>`;
  return `**VF Media · ${channelLabel}** · ${author}\n${message.url}`;
}

export async function handleMediaChannelForward(
  client: Client,
  message: Message,
): Promise<void> {
  if (message.author.id === client.user?.id) return;
  if (!message.guild || !isMediaGuild(message.guild.id)) return;
  if (!mediaForwardSourceChannelIds().has(message.channel.id)) return;
  if (!isTextChannel(message)) return;
  if (message.system) return;
  if (!hasForwardablePayload(message)) return;

  const destId = mediaForwardDestChannelId();
  const dest = await client.channels.fetch(destId).catch(() => null);

  if (!dest?.isTextBased() || dest.isDMBased()) {
    console.error(
      "[media-forward] destination channel missing or not text:",
      destId,
    );
    return;
  }

  if (dest.guildId && dest.guildId !== leagueGuildId()) {
    console.error(
      `[media-forward] destination ${destId} is in guild ${dest.guildId}, expected league ${leagueGuildId()}`,
    );
    return;
  }

  const header = buildForwardHeader(message);
  const body = message.content?.trim() ?? "";
  const content =
    body.length > 0
      ? `${header}\n\n${body}`.slice(0, 2000)
      : header.slice(0, 2000);

  const embeds = message.embeds
    .slice(0, 10)
    .map((e) => EmbedBuilder.from(e.data));

  const files = [...message.attachments.values()]
    .slice(0, 10)
    .map(
      (att) =>
        new AttachmentBuilder(att.url, {
          name: att.name ?? "attachment",
        }),
    );

  const stickerIds = [...message.stickers.values()]
    .map((s) => s.id)
    .filter(Boolean)
    .slice(0, 3);

  try {
    await dest.send({
      content: content.length > 0 ? content : undefined,
      embeds,
      files,
      stickers: stickerIds.length > 0 ? stickerIds : undefined,
      allowedMentions: { parse: [] },
    });
  } catch (err) {
    console.error(
      `[media-forward] send to ${destId} failed (check bot can View + Send Messages there):`,
      err,
    );
  }
}
