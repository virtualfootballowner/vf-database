import { AuditLogEvent, type Guild } from "discord.js";

const BAN_AUDIT_MAX_AGE_MS = 90_000;

/** Recent ban audit reason when the gateway `GuildBan` payload omits `reason`. */
export async function fetchRecentBanAuditReason(
  guild: Guild,
  userId: string,
): Promise<string | null> {
  const uid = String(userId);
  const now = Date.now();

  try {
    const logs = await guild.fetchAuditLogs({
      limit: 16,
      type: AuditLogEvent.MemberBanAdd,
    });
    for (const entry of logs.entries.values()) {
      if (entry.targetId != null && String(entry.targetId) !== uid) continue;
      const target = entry.target;
      if (
        target &&
        typeof target === "object" &&
        "id" in target &&
        target.id != null &&
        String(target.id) !== uid
      ) {
        continue;
      }
      if (now - entry.createdTimestamp > BAN_AUDIT_MAX_AGE_MS) continue;
      const reason = entry.reason?.trim();
      if (reason) return reason;
    }
  } catch (e) {
    console.error("[ban-audit] fetch failed:", e);
  }

  return null;
}
