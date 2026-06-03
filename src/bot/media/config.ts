import { env } from "@/bot/config";
import { mediaGuildId } from "@/bot/referees/config";

export { mediaGuildId };

export function isMediaGuild(guildId: string | null | undefined): boolean {
  if (!guildId) return false;
  const mediaId = mediaGuildId();
  return mediaId != null && guildId === mediaId;
}

export function mediaAssignmentsChannelId(): string | undefined {
  const raw = process.env.DISCORD_MEDIA_ASSIGNMENTS_CHANNEL_ID?.trim();
  return raw && raw.length > 0 ? raw : undefined;
}

export function mediaStreamerRoleId(): string {
  return env.DISCORD_MEDIA_STREAMER_ROLE_ID;
}

export function mediaCommentatorRoleId(): string {
  return env.DISCORD_MEDIA_COMMENTATOR_ROLE_ID;
}

export function mediaStaffRoleId(): string {
  return env.DISCORD_MEDIA_STAFF_ROLE_ID;
}

export function logMediaConfigAtStartup(): void {
  const guild = mediaGuildId();
  if (!guild) return;
  console.log(
    `[media] Guild configured: ${guild}` +
      ` · streamer ${mediaStreamerRoleId()}` +
      ` · commentator ${mediaCommentatorRoleId()}` +
      (mediaAssignmentsChannelId()
        ? ` · assignments ${mediaAssignmentsChannelId()}`
        : ""),
  );
}
