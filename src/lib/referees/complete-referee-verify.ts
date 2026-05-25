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

  return { ok: true, outcome: "pending" };
}
