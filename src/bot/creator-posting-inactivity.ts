import type { Client } from "discord.js";

import { env } from "@/bot/config";
import { createBotSupabase } from "@/bot/stats-queries";
import { parsePostedVideoLinks } from "@/lib/creator-onboard/approved-creators-directory";

/** Days after approval before warning DM + staff ping. */
const WARN_AFTER_DAYS = 3;
/** Total days after approval before removing creator access (5 days after warn). */
const KICK_AFTER_DAYS = 8;

const WARN_AFTER_MS = WARN_AFTER_DAYS * 24 * 60 * 60 * 1000;
const KICK_AFTER_MS = KICK_AFTER_DAYS * 24 * 60 * 60 * 1000;

const TICK_MS = 60 * 60 * 1000; // hourly

function vfGuildId(): string {
  return env.DISCORD_CREATOR_VF_GUILD_ID?.trim() || env.DISCORD_GUILD_ID;
}

function warnDmCopy(): string {
  return [
    "**VF Create — action needed**",
    "",
    `You’ve been approved for **${WARN_AFTER_DAYS} days** and we still don’t see a competition video on your **VF Create directory** profile.`,
    "",
    `Post your **VF** clip on **TikTok or YouTube**, then in the **VF Media** server run **\`/posted\`** and paste the full video link.`,
    "",
    `If you don’t add a link within **${KICK_AFTER_DAYS - WARN_AFTER_DAYS} more days** ( **${KICK_AFTER_DAYS} days** total after approval ), your **Creator** access will be removed automatically.`,
  ].join("\n");
}

function kickDmCopy(): string {
  return [
    "**VF Create — access removed**",
    "",
    "Your **Creator** role was removed because no directory post was added in time after approval.",
    "",
    "When you have a VF video ready, you can go through onboarding again and get approved.",
  ].join("\n");
}

type AppRow = {
  id: string;
  discord_id: string;
  discord_username: string | null;
  roblox_username: string | null;
  approved_at: string | null;
  posted_video_links: unknown;
  posting_inactivity_warned_at: string | null;
};

async function postToStaffChannel(
  client: Client,
  channelId: string,
  payload: { content: string; userId: string },
): Promise<void> {
  try {
    const ch = await client.channels.fetch(channelId);
    if (ch?.isTextBased() && ch.isSendable()) {
      await ch.send({
        content: payload.content,
        allowedMentions: { users: [payload.userId] },
      });
    }
  } catch (e) {
    console.error("[creator-inactivity] staff channel post:", e);
  }
}

export async function runCreatorPostingInactivityCheck(
  client: Client,
): Promise<void> {
  const approvalChannelId = env.DISCORD_CREATOR_APPROVAL_CHANNEL_ID?.trim();
  const scoutRole = env.DISCORD_SCOUT_ROLE_ID?.trim();

  if (!approvalChannelId) {
    console.warn(
      "[creator-inactivity] DISCORD_CREATOR_APPROVAL_CHANNEL_ID unset — will still DM creators; staff channel posts skipped",
    );
  }
  if (!scoutRole) {
    console.warn(
      "[creator-inactivity] DISCORD_SCOUT_ROLE_ID unset — 8-day kick will reject in DB + DM only (no role strip)",
    );
  }

  const supabase = createBotSupabase();
  const { data: rows, error } = await supabase
    .from("creator_applications")
    .select(
      "id, discord_id, discord_username, roblox_username, approved_at, posted_video_links, posting_inactivity_warned_at",
    )
    .eq("status", "approved");

  if (error) {
    console.error(
      "[creator-inactivity] fetch:",
      error,
      "(if this mentions an unknown column, apply the posting_inactivity migration on Supabase)",
    );
    return;
  }

  const list = (rows ?? []) as AppRow[];

  const now = Date.now();
  const isoNow = new Date().toISOString();

  for (const row of list) {
    if (!row.approved_at) continue;
    const approvedAt = new Date(row.approved_at).getTime();
    if (!Number.isFinite(approvedAt)) continue;

    const links = parsePostedVideoLinks(row.posted_video_links);
    const hasPosts = links.length > 0;
    const ageMs = now - approvedAt;

    if (hasPosts) {
      if (row.posting_inactivity_warned_at) {
        const { error: clearErr } = await supabase
          .from("creator_applications")
          .update({
            posting_inactivity_warned_at: null,
            updated_at: isoNow,
          })
          .eq("id", row.id)
          .eq("status", "approved");
        if (clearErr) {
          console.error("[creator-inactivity] clear warned_at:", clearErr);
        }
      }
      continue;
    }

    if (ageMs >= KICK_AFTER_MS) {
      const { data: freshList, error: freshErr } = await supabase
        .from("creator_applications")
        .select("id, discord_id, posted_video_links, status")
        .eq("id", row.id)
        .eq("status", "approved")
        .maybeSingle();

      if (freshErr || !freshList) continue;
      if (parsePostedVideoLinks(freshList.posted_video_links).length > 0) {
        continue;
      }

      if (scoutRole) {
        try {
          const guild = await client.guilds.fetch(vfGuildId());
          let member;
          try {
            member = await guild.members.fetch(row.discord_id);
          } catch {
            member = null;
          }

          if (member?.roles.cache.has(scoutRole)) {
            try {
              await member.roles.remove(
                scoutRole,
                "VF Create: no /posted within posting window",
              );
            } catch (e) {
              console.error("[creator-inactivity] role remove:", e);
            }
          }
        } catch (e) {
          console.error("[creator-inactivity] guild fetch (kick):", e);
        }
      }

      const { error: upErr } = await supabase
        .from("creator_applications")
        .update({
          status: "rejected",
          rejection_reason:
            "VF Create: Creator access removed — no directory post within 8 days of approval. Re-apply when you have a video link.",
          posted_video_links: [],
          posting_inactivity_warned_at: null,
          updated_at: isoNow,
        })
        .eq("id", row.id)
        .eq("status", "approved");

      if (upErr) {
        console.error("[creator-inactivity] reject update:", upErr);
        continue;
      }

      try {
        const u = await client.users.fetch(row.discord_id);
        await u.send({ content: kickDmCopy() });
      } catch (e) {
        console.warn(
          `[creator-inactivity] kick DM failed ${row.discord_id}:`,
          e,
        );
      }

      if (approvalChannelId) {
        await postToStaffChannel(client, approvalChannelId, {
          userId: row.discord_id,
          content: [
            "**VF Create · posting inactivity — removed**",
            `<@${row.discord_id}>`,
            row.discord_username
              ? `Discord tag: \`${row.discord_username}\``
              : null,
            row.roblox_username
              ? `Roblox: \`${row.roblox_username}\``
              : null,
            `_No directory posts within ${KICK_AFTER_DAYS} days of approval · Creator role stripped · application rejected_`,
          ]
            .filter(Boolean)
            .join("\n"),
        });
      }

      console.log(
        `[creator-inactivity] removed ${row.discord_id} (${row.roblox_username ?? "?"}) for no posts`,
      );
      continue;
    }

    if (ageMs >= WARN_AFTER_MS && !row.posting_inactivity_warned_at) {
      const { data: locked, error: lockErr } = await supabase
        .from("creator_applications")
        .update({
          posting_inactivity_warned_at: isoNow,
          updated_at: isoNow,
        })
        .eq("id", row.id)
        .eq("status", "approved")
        .is("posting_inactivity_warned_at", null)
        .select("id")
        .maybeSingle();

      if (lockErr || !locked) continue;

      try {
        const u = await client.users.fetch(row.discord_id);
        await u.send({ content: warnDmCopy() });
      } catch (e) {
        console.warn(
          `[creator-inactivity] warn DM failed ${row.discord_id}:`,
          e,
        );
      }

      if (approvalChannelId) {
        await postToStaffChannel(client, approvalChannelId, {
          userId: row.discord_id,
          content: [
            "**VF Create · posting inactivity — warned**",
            `<@${row.discord_id}>`,
            row.discord_username
              ? `Discord tag: \`${row.discord_username}\``
              : null,
            row.roblox_username
              ? `Roblox: \`${row.roblox_username}\``
              : null,
            `_Approved ${WARN_AFTER_DAYS}+ days ago with no \`/posted\` link · member was DM’d (check logs if DMs closed)_`,
          ]
            .filter(Boolean)
            .join("\n"),
        });
      }

      console.log(
        `[creator-inactivity] warned ${row.discord_id} (${row.roblox_username ?? "?"})`,
      );
    }
  }

  console.log(
    `[creator-inactivity] tick complete · ${list.length} approved row(s) scanned`,
  );
}

export function scheduleCreatorPostingInactivityJob(client: Client): void {
  void runCreatorPostingInactivityCheck(client).catch((e) => {
    console.error("[creator-inactivity] initial run:", e);
  });

  setInterval(() => {
    void runCreatorPostingInactivityCheck(client).catch((e) => {
      console.error("[creator-inactivity] tick:", e);
    });
  }, TICK_MS);
}
