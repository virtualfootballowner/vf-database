import { config as loadEnv } from "dotenv";
import { z } from "zod";

// Load local env files when running bot outside Next.js runtime.
loadEnv({ path: ".env.local", override: true });
loadEnv({ override: false });

/** Optional channel: treat blank / whitespace as unset (common in Railway UI). */
const optionalOutgoingChannel = z.preprocess(
  (raw) => {
    if (raw == null) return undefined;
    if (typeof raw !== "string") return raw;
    const t = raw.trim();
    return t.length > 0 ? t : undefined;
  },
  z.string().min(1).optional(),
);

const envSchema = z.object({
  DISCORD_BOT_TOKEN: z.string().min(1),
  DISCORD_GUILD_ID: z.string().min(1).transform((s) => s.trim()),
  /** Role granted after user completes website /verify (Discord+Roblox). Replaces third-party verify bots. */
  DISCORD_ROVER_VERIFIED_ROLE_ID: z
    .string()
    .min(1)
    .transform((s) => s.trim()),
  DISCORD_APPROVED_ROLE_ID: z.string().min(1).transform((s) => s.trim()),
  DISCORD_STAFF_REVIEW_CHANNEL_ID: z
    .string()
    .min(1)
    .transform((s) => s.trim()),
  DISCORD_SYNC_LOG_CHANNEL_ID: z
    .string()
    .min(1)
    .transform((s) => s.trim()),
  /** Given to Discord users when an admin /appoint's them as a club manager. */
  DISCORD_TEAM_MANAGER_ROLE_ID: z
    .string()
    .min(1)
    .transform((s) => s.trim()),
  /** Outgoing log: posts when members leave (ban / kick / voluntary). Optional — omit to disable. */
  DISCORD_MEMBER_OUTGOING_CHANNEL_ID: optionalOutgoingChannel,
  /**
   * Public channel where every `/scrimmage` lobby card is posted (FACEIT-style
   * pickup system). Optional — leave unset until the lobby flow ships; the
   * read-only `/scrimmage stats` and `/scrimmage leaderboard` commands work
   * without it.
   */
  DISCORD_SCRIMMAGE_LOBBY_CHANNEL_ID: optionalOutgoingChannel,
  /**
   * Roblox `placeId` of the VF "lobby" experience players land in when
   * they click the join link from #scrimmage-lobby. The lobby place is
   * responsible for verify-player + reserving + teleporting to the
   * actual game's reserved server. Optional — when unset the bot still
   * announces the live match but skips the join URL.
   *
   * See docs/roblox-private-server-architecture.md for the full Lua
   * lobby contract.
   */
  VF_ROBLOX_LOBBY_PLACE_ID: optionalOutgoingChannel,
  /**
   * Creator program: private staff channel for application review cards.
   * The website posts here with DISCORD_BOT_TOKEN (same pattern as /verify).
   */
  DISCORD_CREATOR_APPROVAL_CHANNEL_ID: optionalOutgoingChannel,
  /** Role granted when a creator application is approved (e.g. @Scout). */
  DISCORD_SCOUT_ROLE_ID: optionalOutgoingChannel,
  /**
   * Guild where Scout role + nickname are applied. Defaults to DISCORD_GUILD_ID
   * when unset (same server as league).
   */
  DISCORD_CREATOR_VF_GUILD_ID: optionalOutgoingChannel,
  /**
   * Full Discord client URL to #new-creator-checklist (VF Media). Shown in the
   * approval DM. Example: https://discord.com/channels/{guild_id}/{channel_id}
   */
  DISCORD_CREATOR_CHECKLIST_CHANNEL_URL: optionalOutgoingChannel,
  /**
   * Invite link for the VF Private Testing Hub (creator access). Shown in the
   * creator approval DM. Defaults in code when unset.
   */
  DISCORD_CREATOR_PRIVATE_TESTING_INVITE_URL: optionalOutgoingChannel,
  /**
   * Role added when **media staff** onboarding is approved (VF Media).
   * Defaults in code when unset.
   */
  DISCORD_MEDIA_STAFF_ROLE_ID: z.preprocess((raw) => {
    if (raw == null || raw === "") return "1503912250702823524";
    const s = String(raw).trim();
    return s.length > 0 ? s : "1503912250702823524";
  }, z.string().min(1)),
  /**
   * Specialty roles auto-added alongside the base media staff role, based on
   * the role the applicant selected on their VF Media application. Each one
   * defaults to the production VF Media role id and may be overridden via env.
   */
  DISCORD_MEDIA_REPORTER_ROLE_ID: z.preprocess((raw) => {
    if (raw == null || raw === "") return "1504559575502688336";
    const s = String(raw).trim();
    return s.length > 0 ? s : "1504559575502688336";
  }, z.string().min(1)),
  DISCORD_MEDIA_GFX_ROLE_ID: z.preprocess((raw) => {
    if (raw == null || raw === "") return "1504559619605926011";
    const s = String(raw).trim();
    return s.length > 0 ? s : "1504559619605926011";
  }, z.string().min(1)),
  DISCORD_MEDIA_STREAMER_ROLE_ID: z.preprocess((raw) => {
    if (raw == null || raw === "") return "1504559657337753621";
    const s = String(raw).trim();
    return s.length > 0 ? s : "1504559657337753621";
  }, z.string().min(1)),
  DISCORD_MEDIA_COMMENTATOR_ROLE_ID: z.preprocess((raw) => {
    if (raw == null || raw === "") return "1504559699025199287";
    const s = String(raw).trim();
    return s.length > 0 ? s : "1504559699025199287";
  }, z.string().min(1)),
  /**
   * Admin-only log channel notified whenever a VF Create creator runs
   * `/posted` to add a new directory link. Defaults in code when unset.
   */
  DISCORD_CREATOR_POSTED_LOG_CHANNEL_ID: z.preprocess((raw) => {
    if (raw == null || raw === "") return "1503965608390164520";
    const s = String(raw).trim();
    return s.length > 0 ? s : "1503965608390164520";
  }, z.string().min(1)),
  /**
   * Public feed channel that gets a plain non-embedded "@creator just posted"
   * message every time someone runs `/posted`. The link is sent as raw text
   * so Discord unfurls the TikTok / YouTube player inline.
   */
  DISCORD_CREATOR_POSTED_FEED_CHANNEL_ID: z.preprocess((raw) => {
    if (raw == null || raw === "") return "1504012980533330000";
    const s = String(raw).trim();
    return s.length > 0 ? s : "1504012980533330000";
  }, z.string().min(1)),
  /**
   * Public channel for league Discord ban announcements (Roblox-linked profile,
   * duration, reason). Defaults to VF Media bans feed.
   */
  DISCORD_PUBLIC_BAN_LOG_CHANNEL_ID: z.preprocess((raw) => {
    if (raw == null || raw === "") return "1504550802906419232";
    const s = String(raw).trim();
    return s.length > 0 ? s : "1504550802906419232";
  }, z.string().min(1)),
  /** Invite link for the main VF League Discord (bail / ticket instructions in ban DMs). */
  DISCORD_LEAGUE_INVITE_URL: optionalOutgoingChannel,
  /** Channel or doc link for opening a bail / support ticket (optional). */
  DISCORD_BAIL_TICKET_CHANNEL_URL: optionalOutgoingChannel,
  SUPABASE_URL: z.url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  ROBLOX_API_BASE_URL: z.string().url().default("https://users.roblox.com"),
  VFL_SITE_URL: z
    .string()
    .url()
    .default("https://myvirtualfootball.com"),
  /**
   * Only this season’s rosters can be updated via `/contract`. Older seasons stay frozen.
   */
  VF_ACTIVE_ROSTER_SEASON: z.preprocess((raw) => {
    if (raw == null || raw === "") return 3;
    const n = Number(raw);
    return Number.isFinite(n) && n >= 1 && n <= 99 ? n : 3;
  }, z.number().int().min(1).max(99)),
});

export const env = envSchema.parse({
  DISCORD_BOT_TOKEN: process.env.DISCORD_BOT_TOKEN,
  DISCORD_GUILD_ID: process.env.DISCORD_GUILD_ID,
  DISCORD_ROVER_VERIFIED_ROLE_ID: process.env.DISCORD_ROVER_VERIFIED_ROLE_ID,
  DISCORD_APPROVED_ROLE_ID: process.env.DISCORD_APPROVED_ROLE_ID,
  DISCORD_STAFF_REVIEW_CHANNEL_ID: process.env.DISCORD_STAFF_REVIEW_CHANNEL_ID,
  DISCORD_SYNC_LOG_CHANNEL_ID: process.env.DISCORD_SYNC_LOG_CHANNEL_ID,
  DISCORD_TEAM_MANAGER_ROLE_ID: process.env.DISCORD_TEAM_MANAGER_ROLE_ID,
  DISCORD_MEMBER_OUTGOING_CHANNEL_ID: process.env.DISCORD_MEMBER_OUTGOING_CHANNEL_ID,
  DISCORD_SCRIMMAGE_LOBBY_CHANNEL_ID: process.env.DISCORD_SCRIMMAGE_LOBBY_CHANNEL_ID,
  VF_ROBLOX_LOBBY_PLACE_ID: process.env.VF_ROBLOX_LOBBY_PLACE_ID,
  DISCORD_CREATOR_APPROVAL_CHANNEL_ID:
    process.env.DISCORD_CREATOR_APPROVAL_CHANNEL_ID,
  DISCORD_SCOUT_ROLE_ID: process.env.DISCORD_SCOUT_ROLE_ID,
  DISCORD_CREATOR_VF_GUILD_ID: process.env.DISCORD_CREATOR_VF_GUILD_ID,
  DISCORD_CREATOR_CHECKLIST_CHANNEL_URL:
    process.env.DISCORD_CREATOR_CHECKLIST_CHANNEL_URL,
  DISCORD_CREATOR_PRIVATE_TESTING_INVITE_URL:
    process.env.DISCORD_CREATOR_PRIVATE_TESTING_INVITE_URL,
  DISCORD_MEDIA_STAFF_ROLE_ID: process.env.DISCORD_MEDIA_STAFF_ROLE_ID,
  DISCORD_MEDIA_REPORTER_ROLE_ID: process.env.DISCORD_MEDIA_REPORTER_ROLE_ID,
  DISCORD_MEDIA_GFX_ROLE_ID: process.env.DISCORD_MEDIA_GFX_ROLE_ID,
  DISCORD_MEDIA_STREAMER_ROLE_ID: process.env.DISCORD_MEDIA_STREAMER_ROLE_ID,
  DISCORD_MEDIA_COMMENTATOR_ROLE_ID:
    process.env.DISCORD_MEDIA_COMMENTATOR_ROLE_ID,
  DISCORD_CREATOR_POSTED_LOG_CHANNEL_ID:
    process.env.DISCORD_CREATOR_POSTED_LOG_CHANNEL_ID,
  DISCORD_CREATOR_POSTED_FEED_CHANNEL_ID:
    process.env.DISCORD_CREATOR_POSTED_FEED_CHANNEL_ID,
  DISCORD_PUBLIC_BAN_LOG_CHANNEL_ID:
    process.env.DISCORD_PUBLIC_BAN_LOG_CHANNEL_ID,
  DISCORD_LEAGUE_INVITE_URL: process.env.DISCORD_LEAGUE_INVITE_URL,
  DISCORD_BAIL_TICKET_CHANNEL_URL:
    process.env.DISCORD_BAIL_TICKET_CHANNEL_URL,
  SUPABASE_URL: process.env.SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  ROBLOX_API_BASE_URL: process.env.ROBLOX_API_BASE_URL,
  VFL_SITE_URL: process.env.VFL_SITE_URL,
  VF_ACTIVE_ROSTER_SEASON: process.env.VF_ACTIVE_ROSTER_SEASON,
});
