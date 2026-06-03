import { env } from "@/bot/config";

const DEFAULT_REFEREE_GUILD_ID = "1506682501605883995";
const DEFAULT_REFEREE_ROLE_ID = "1507087134497181798";
const DEFAULT_REFEREE_APPROVAL_CHANNEL_ID = "1508189919732830278";

export function refereeGuildId(): string {
  return (
    process.env.DISCORD_REFEREE_GUILD_ID?.trim() || DEFAULT_REFEREE_GUILD_ID
  );
}

export function refereeRoleId(): string {
  return process.env.DISCORD_REFEREE_ROLE_ID?.trim() || DEFAULT_REFEREE_ROLE_ID;
}

export function refereeApprovalChannelId(): string {
  return (
    process.env.DISCORD_REFEREE_APPROVAL_CHANNEL_ID?.trim() ||
    DEFAULT_REFEREE_APPROVAL_CHANNEL_ID
  );
}

export function refereeAssignmentsChannelId(): string | undefined {
  const raw = process.env.DISCORD_REFEREE_ASSIGNMENTS_CHANNEL_ID?.trim();
  return raw && raw.length > 0 ? raw : undefined;
}

export function refereeStaffRoleId(): string | undefined {
  const raw = process.env.DISCORD_REFEREE_STAFF_ROLE_ID?.trim();
  return raw && raw.length > 0 ? raw : undefined;
}

export function isRefereeGuild(guildId: string | null | undefined): boolean {
  if (!guildId) return false;
  return guildId === refereeGuildId();
}

export function isMediaGuild(guildId: string | null | undefined): boolean {
  if (!guildId) return false;
  return guildId === mediaGuildId();
}

export function logRefereeConfigAtStartup(): void {
  console.log(
    `[referee] Guild configured: ${refereeGuildId()} · role ${refereeRoleId()} · approval ${refereeApprovalChannelId()}` +
      (refereeAssignmentsChannelId()
        ? ` · assignments ${refereeAssignmentsChannelId()}`
        : ""),
  );
}

export function leagueGuildId(): string {
  return env.DISCORD_GUILD_ID;
}

/** VF Media Discord — same fallback chain as media-staff onboarding. */
export function mediaGuildId(): string {
  return (
    process.env.DISCORD_MEDIA_GUILD_ID?.trim() ||
    env.DISCORD_CREATOR_VF_GUILD_ID?.trim() ||
    env.DISCORD_GUILD_ID
  );
}