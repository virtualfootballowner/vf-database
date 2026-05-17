/** Shared league Discord ban checks (players table). */

export type DiscordBanRow = {
  discord_banned_at: string | null;
  discord_banned_until: string | null;
};

export function isDiscordBanActive(
  row: DiscordBanRow | null | undefined,
): boolean {
  if (!row?.discord_banned_at) return false;
  const until = row.discord_banned_until;
  if (!until?.trim()) return true;
  const t = new Date(until).getTime();
  if (!Number.isFinite(t)) return true;
  return Date.now() < t;
}

export function describeBanForUi(row: DiscordBanRow | null | undefined): {
  active: boolean;
  isPermanent: boolean;
  untilLabel: string | null;
} {
  if (!isDiscordBanActive(row)) {
    return { active: false, isPermanent: false, untilLabel: null };
  }
  const until = row?.discord_banned_until?.trim();
  if (!until) {
    return { active: true, isPermanent: true, untilLabel: null };
  }
  return { active: true, isPermanent: false, untilLabel: until };
}

const HOUR_MS = 3600_000;
const DAY_MS = 86400_000;

/** Slash `/ban` choice value → length. Keys match Discord command `addChoices` values. */
const BAN_DURATION_MS: Record<string, number> = {
  "1h": HOUR_MS,
  "6h": 6 * HOUR_MS,
  "12h": 12 * HOUR_MS,
  "1d": DAY_MS,
  "3d": 3 * DAY_MS,
  "7d": 7 * DAY_MS,
  "14d": 14 * DAY_MS,
  "30d": 30 * DAY_MS,
};

/** `null` = permanent; invalid choice yields `null` (caller should treat as permanent or reject). */
export function banUntilFromDurationChoice(
  choice: string,
  from: Date,
): Date | null {
  const c = choice.trim();
  if (c === "permanent") return null;
  const ms = BAN_DURATION_MS[c];
  if (ms == null) return null;
  return new Date(from.getTime() + ms);
}

export function discordBanSlashDurationLabel(choice: string): string {
  const labels: Record<string, string> = {
    permanent: "Permanent",
    "1h": "1 hour",
    "6h": "6 hours",
    "12h": "12 hours",
    "1d": "1 day",
    "3d": "3 days",
    "7d": "7 days",
    "14d": "14 days",
    "30d": "30 days",
  };
  return labels[choice] ?? choice;
}
