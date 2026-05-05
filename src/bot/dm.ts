import type { GuildMember, MessageCreateOptions, User } from "discord.js";

import { env } from "@/bot/config";

export type DmTarget = GuildMember | User;

export type SafeDmResult =
  | { ok: true }
  | { ok: false; reason: "disabled" | "blocked" | "no_target" | "send_failed"; error?: unknown };

/**
 * Centralized "consequence DM" sender.
 *
 * Use ONLY for messages that respond to a specific user/staff action targeting
 * this user (welcome after they verified, /kick reason, denial notice, etc.).
 * Never use for bulk or unsolicited outreach — that's what got the old bot
 * flagged. Bulk join/reminder flows must use a public channel post instead.
 *
 * - Honors the global `BOT_DM_DISABLED` kill switch.
 * - Catches all errors so the caller can never crash on a closed-DM user.
 * - Logs once per failure with a short label so we can trace which flow tried.
 */
export async function safeSendDm(
  target: DmTarget | null | undefined,
  payload: MessageCreateOptions,
  label: string,
): Promise<SafeDmResult> {
  if (env.BOT_DM_DISABLED) {
    return { ok: false, reason: "disabled" };
  }
  if (!target) {
    return { ok: false, reason: "no_target" };
  }
  try {
    await target.send(payload);
    return { ok: true };
  } catch (err) {
    // Discord throws DiscordAPIError 50007 ("Cannot send messages to this user")
    // when DMs are closed. Treat any send failure as a soft no-op.
    const code =
      err && typeof err === "object" && "code" in err
        ? (err as { code: unknown }).code
        : null;
    if (code === 50007 || code === "50007") {
      return { ok: false, reason: "blocked" };
    }
    console.warn(`[dm:${label}] send failed:`, err);
    return { ok: false, reason: "send_failed", error: err };
  }
}

/**
 * Standardized footer line that explains why the recipient is getting a DM.
 * Append this to any consequence-DM embed so users understand the bot isn't
 * just spamming them out of the blue. Keep it short.
 */
export function consequenceFooter(reason: string): string {
  return `VFL Bot · ${reason}`;
}
