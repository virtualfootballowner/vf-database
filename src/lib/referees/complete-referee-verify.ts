import { postRefereeApprovalCardViaDiscordApi } from "@/lib/referees/post-referee-approval-card";
import { upsertRefereePendingFromVerify } from "@/lib/referees/referee-verify-db";
import { getRobloxHeadshotsForBot } from "@/lib/roblox";

const DISCORD_API = "https://discord.com/api/v10";

async function fetchDiscordUsername(
  botToken: string,
  userId: string,
): Promise<string> {
  const res = await fetch(`${DISCORD_API}/users/${userId}`, {
    headers: { Authorization: `Bot ${botToken}` },
  });
  if (!res.ok) return userId;
  const u = (await res.json()) as {
    username?: string;
    global_name?: string | null;
  };
  return u.global_name?.trim() || u.username?.trim() || userId;
}

async function sendRefereeVerifyPendingDm(
  botToken: string,
  discordUserId: string,
  alreadyPending: boolean,
): Promise<void> {
  const content = alreadyPending
    ? "**VF Referees — verification updated.** Your nickname was refreshed. You're still waiting on staff review — you'll get the **Referee** role once approved."
    : "**VF Referees — verification received.** Your Discord and Roblox are linked and your nickname is set. Staff will review you shortly — you'll get the **Referee** role once approved.";

  try {
    const dmRes = await fetch(`${DISCORD_API}/users/@me/channels`, {
      method: "POST",
      headers: {
        Authorization: `Bot ${botToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ recipient_id: discordUserId }),
    });
    if (!dmRes.ok) return;

    const ch = (await dmRes.json()) as { id?: string };
    if (!ch.id) return;

    await fetch(`${DISCORD_API}/channels/${ch.id}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bot ${botToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ content }),
    });
  } catch (e) {
    console.warn("[referee] verify pending DM failed:", e);
  }
}

export type CompleteRefereeVerifyResult =
  | { ok: true; outcome: "pending" | "already_pending" | "already_active" }
  | {
      ok: false;
      code:
        | "suspended"
        | "db_error"
        | "card_failed"
        | "missing_channel";
      error?: string;
    };

export async function completeRefereeVerify(opts: {
  botToken: string;
  approvalChannelId: string;
  discordUserId: string;
  robloxUserId: string;
  robloxUsername: string;
}): Promise<CompleteRefereeVerifyResult> {
  const discordUsername = await fetchDiscordUsername(
    opts.botToken,
    opts.discordUserId,
  );

  const saved = await upsertRefereePendingFromVerify({
    discordId: opts.discordUserId,
    discordUsername,
    robloxUsername: opts.robloxUsername,
    robloxUserId: opts.robloxUserId,
  });

  if (!saved.ok) {
    if (saved.code === "already_active") {
      return { ok: true, outcome: "already_active" };
    }
    return {
      ok: false,
      code: saved.code === "suspended" ? "suspended" : "db_error",
      error: saved.error,
    };
  }

  if (saved.outcome === "already_pending") {
    await sendRefereeVerifyPendingDm(opts.botToken, opts.discordUserId, true);
    return { ok: true, outcome: "already_pending" };
  }

  if (!opts.approvalChannelId.trim()) {
    return { ok: false, code: "missing_channel" };
  }

  const headshots = await getRobloxHeadshotsForBot([opts.robloxUserId], "180x180");
  const posted = await postRefereeApprovalCardViaDiscordApi({
    botToken: opts.botToken,
    channelId: opts.approvalChannelId,
    discordId: opts.discordUserId,
    discordUsername,
    robloxUsername: opts.robloxUsername,
    robloxUserId: opts.robloxUserId,
    headshotUrl: headshots.get(opts.robloxUserId) ?? null,
  });

  if (!posted.ok) {
    console.error("[referee] approval card post:", posted.detail);
    return { ok: false, code: "card_failed", error: posted.detail };
  }

  await sendRefereeVerifyPendingDm(opts.botToken, opts.discordUserId, false);
  return { ok: true, outcome: "pending" };
}
