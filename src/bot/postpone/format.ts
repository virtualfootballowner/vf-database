export const DEFAULT_POSTPONE_TIMEZONE = "Europe/London";

export const POSTPONE_TIMEZONE_CHOICES = [
  { name: "UK — London (GMT/BST)", value: "Europe/London" },
  { name: "US — Eastern (ET)", value: "America/New_York" },
  { name: "US — Central (CT)", value: "America/Chicago" },
  { name: "US — Mountain (MT)", value: "America/Denver" },
  { name: "US — Pacific (PT)", value: "America/Los_Angeles" },
  { name: "Canada — Toronto", value: "America/Toronto" },
  { name: "Central Europe (CET/CEST)", value: "Europe/Paris" },
  { name: "Gulf — Dubai", value: "Asia/Dubai" },
  { name: "India (IST)", value: "Asia/Kolkata" },
  { name: "Australia — Sydney", value: "Australia/Sydney" },
  { name: "Brazil — São Paulo", value: "America/Sao_Paulo" },
  { name: "Japan (JST)", value: "Asia/Tokyo" },
  { name: "South Africa (SAST)", value: "Africa/Johannesburg" },
] as const;

export type PostponeTimezone = (typeof POSTPONE_TIMEZONE_CHOICES)[number]["value"];

const TIMEZONE_VALUES = new Set<string>(
  POSTPONE_TIMEZONE_CHOICES.map((c) => c.value),
);

export function isValidPostponeTimezone(value: string): value is PostponeTimezone {
  return TIMEZONE_VALUES.has(value);
}

export function postponeTimezoneLabel(value: string): string {
  const hit = POSTPONE_TIMEZONE_CHOICES.find((c) => c.value === value);
  return hit?.name ?? value;
}

const DISPLAY_FORMATTER = new Intl.DateTimeFormat("en-US", {
  weekday: "long",
  month: "long",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZone: DEFAULT_POSTPONE_TIMEZONE,
});

const LOG_FORMATTER = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZone: DEFAULT_POSTPONE_TIMEZONE,
});

/** Discord dynamic timestamp — renders in each user's local timezone (grey highlight). */
export function discordKickoffTimestamp(
  iso: string | null | undefined,
  style: "F" | "f" | "t" | "T" | "d" | "D" | "R" = "F",
): string {
  if (!iso) return "TBD";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "TBD";
  const unix = Math.floor(d.getTime() / 1000);
  return `<t:${unix}:${style}>`;
}

/** Full local datetime plus relative (e.g. "in 2 days"). */
export function discordKickoffTimestampRich(
  iso: string | null | undefined,
): string {
  if (!iso) return "TBD";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "TBD";
  const unix = Math.floor(d.getTime() / 1000);
  return `<t:${unix}:F> · <t:${unix}:R>`;
}

export function formatFixtureWhen(
  iso: string | null | undefined,
  timeZone: string = DEFAULT_POSTPONE_TIMEZONE,
): string {
  if (!iso) return "TBD";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "TBD";
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone,
  }).format(d);
}

/** Fixture time with short timezone label (e.g. "Sunday, July 6, 5:00 PM EDT"). */
export function formatFixtureWhenWithZone(
  iso: string | null | undefined,
  timeZone: string,
): string {
  if (!iso) return "TBD";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "TBD";
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone,
    timeZoneName: "short",
  }).format(d);
}

export function formatDenialWhen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return LOG_FORMATTER.format(d);
}

function localWallClockToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  timeZone: string,
): Date {
  let ts = Date.UTC(year, month - 1, day, hour, minute);
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });

  for (let attempt = 0; attempt < 4; attempt++) {
    const parts = formatter.formatToParts(new Date(ts));
    const pick = (type: Intl.DateTimeFormatPartTypes) =>
      Number(parts.find((p) => p.type === type)?.value ?? 0);
    const ly = pick("year");
    const lm = pick("month");
    const ld = pick("day");
    const lh = pick("hour");
    const lmin = pick("minute");

    const target = Date.UTC(year, month - 1, day, hour, minute);
    const actual = Date.UTC(ly, lm - 1, ld, lh, lmin);
    const delta = target - actual;
    if (delta === 0) break;
    ts += delta;
  }

  return new Date(ts);
}

/** Parse YYYY-MM-DD + flexible clock string in the given IANA timezone → UTC ISO. */
export function parseProposedDateTime(
  dateRaw: string,
  timeRaw: string,
  timeZone: string = DEFAULT_POSTPONE_TIMEZONE,
): { ok: true; iso: string } | { ok: false; message: string } {
  if (!isValidPostponeTimezone(timeZone)) {
    return { ok: false, message: "Pick a valid **timezone** from the dropdown." };
  }

  const tzLabel = postponeTimezoneLabel(timeZone);
  const dateMatch = dateRaw.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!dateMatch) {
    return {
      ok: false,
      message:
        `Use **YYYY-MM-DD** for the date (e.g. \`2026-07-06\`). Times use **${tzLabel}**.`,
    };
  }
  const [, y, mo, d] = dateMatch;
  const time = timeRaw.trim().toLowerCase().replace(/\s+/g, " ");

  let hour = 0;
  let minute = 0;

  const h24 = time.match(/^(\d{1,2}):(\d{2})$/);
  const h12 = time.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)$/);

  if (h24) {
    hour = Number.parseInt(h24[1]!, 10);
    minute = Number.parseInt(h24[2]!, 10);
  } else if (h12) {
    hour = Number.parseInt(h12[1]!, 10);
    minute = h12[2] ? Number.parseInt(h12[2], 10) : 0;
    const mer = h12[3];
    if (mer === "pm" && hour < 12) hour += 12;
    if (mer === "am" && hour === 12) hour = 0;
  } else {
    return {
      ok: false,
      message:
        `Could not parse the time. Use **17:00** or **5:00 PM** (${tzLabel}).`,
    };
  }

  if (
    hour < 0 ||
    hour > 23 ||
    minute < 0 ||
    minute > 59 ||
    Number.isNaN(hour) ||
    Number.isNaN(minute)
  ) {
    return { ok: false, message: "That time is not valid." };
  }

  const utc = localWallClockToUtc(
    Number.parseInt(y!, 10),
    Number.parseInt(mo!, 10),
    Number.parseInt(d!, 10),
    hour,
    minute,
    timeZone,
  );

  if (Number.isNaN(utc.getTime())) {
    return { ok: false, message: "That date/time combination is not valid." };
  }

  if (utc.getTime() <= Date.now()) {
    return {
      ok: false,
      message: "The proposed kickoff must be **in the future**.",
    };
  }

  return { ok: true, iso: utc.toISOString() };
}

export function formatCaseNumber(caseNumber: number): string {
  return String(caseNumber).padStart(4, "0");
}

const POSTPONEMENT_STATUS_LABELS: Record<string, string> = {
  pending_opponent: "⏳ Awaiting opponent",
  accepted: "✅ Accepted",
  denied: "❌ Denied",
  expired: "⏰ Expired (no response)",
  escalated: "🚨 Escalated to staff",
  staff_approved: "✅ Staff approved",
  staff_force_original: "🔒 Staff kept original",
  staff_set_time: "📅 Staff set time",
  superseded: "↩ Superseded",
};

export function formatPostponementStatus(status: string): string {
  return POSTPONEMENT_STATUS_LABELS[status] ?? status;
}

/** Compact Discord timestamp for admin logs. */
export function discordLogTimestamp(
  iso: string | null | undefined,
): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const unix = Math.floor(d.getTime() / 1000);
  return `<t:${unix}:f> (<t:${unix}:R>)`;
}

export type DenialLogEntry = {
  denied_at: string;
  reason: string | null;
  denied_by_discord_id: string;
};

export function parseDenialLog(raw: unknown): DenialLogEntry[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (e): e is DenialLogEntry =>
      typeof e === "object" &&
      e !== null &&
      typeof (e as DenialLogEntry).denied_at === "string" &&
      typeof (e as DenialLogEntry).denied_by_discord_id === "string",
  );
}

export function renderDenialLog(entries: DenialLogEntry[]): string {
  if (entries.length === 0) return "_No denials recorded._";
  return entries
    .map((e) => {
      const when = formatDenialWhen(e.denied_at);
      const reason = e.reason?.trim()
        ? `"${e.reason.trim()}"`
        : "no reason given";
      return `❌ ${when} — ${reason}`;
    })
    .join("\n");
}
