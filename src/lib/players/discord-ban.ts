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

const DAY_MS = 86400_000;

/**
 * Slash `/ban` choice value → length. Keys match Discord `addChoices` values.
 * Months use 30-day months. Seasons are calendar approximations (tune if VF defines season length elsewhere).
 */
const BAN_DURATION_MS: Record<string, number> = {
  "1w": 7 * DAY_MS,
  "2w": 14 * DAY_MS,
  "3w": 21 * DAY_MS,
  "1mo": 30 * DAY_MS,
  "2mo": 60 * DAY_MS,
  "3mo": 90 * DAY_MS,
  "4mo": 120 * DAY_MS,
  /** ~6 months — policy default; not read from DB seasons */
  "1season": 180 * DAY_MS,
  /** ~12 months — policy default */
  "2season": 365 * DAY_MS,
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
    "1w": "1 week",
    "2w": "2 weeks",
    "3w": "3 weeks",
    "1mo": "1 month",
    "2mo": "2 months",
    "3mo": "3 months",
    "4mo": "4 months",
    "1season": "1 season",
    "2season": "2 seasons",
    permanent: "Permanent",
  };
  return labels[choice] ?? choice;
}
