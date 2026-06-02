/** World Cup group-stage kickoffs are scheduled in BST (June = UTC+1). */

const DATE_FORMATTER = new Intl.DateTimeFormat("en-GB", {
  weekday: "short",
  day: "2-digit",
  month: "short",
  year: "numeric",
  timeZone: "Europe/London",
});

const EST_TIME_FORMATTER = new Intl.DateTimeFormat("en-US", {
  hour: "numeric",
  minute: "2-digit",
  timeZone: "America/New_York",
  timeZoneName: "short",
});

/** True GMT (UTC) — not BST/GMT+1 wall labels. */
const GMT_TIME_FORMATTER = new Intl.DateTimeFormat("en-US", {
  hour: "numeric",
  minute: "2-digit",
  timeZone: "UTC",
  timeZoneName: "short",
});

/** US Eastern + GMT (UTC). Add local via {@link formatLocalKickoffTime} on the client. */
export function formatDualTimezoneKickoffTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return `${EST_TIME_FORMATTER.format(d)} / ${GMT_TIME_FORMATTER.format(d)}`;
}

export function resolvedVisitorTimeZone(): string {
  if (typeof Intl === "undefined") return "UTC";
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
}

/** How we label the visitor zone in brackets — IANA id with spaces for clarity. */
export function formatVisitorTimeZoneLabel(timeZone?: string): string {
  const tz = timeZone?.trim() || resolvedVisitorTimeZone();
  return tz.replace(/_/g, " ");
}

/** Visitor wall-clock + bracketed zone, e.g. `15:22 (Pacific/Auckland)`. */
export function formatLocalKickoffTime(
  iso: string,
  timeZone?: string,
): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const tz = timeZone?.trim() || resolvedVisitorTimeZone();
  const time = new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: tz,
  }).format(d);
  return `${time} (${formatVisitorTimeZoneLabel(tz)})`;
}

/** Build UTC ISO string from a calendar date and clock time in BST. */
export function bstKickoffIso(date: string, timeBst: string): string {
  const [hour, minute] = timeBst.split(":").map((v) => Number.parseInt(v, 10));
  const hh = String(hour).padStart(2, "0");
  const mm = String(minute).padStart(2, "0");
  return new Date(`${date}T${hh}:${mm}:00+01:00`).toISOString();
}

export function buildKickoffGrid(
  dates: readonly string[],
  slotsBst: readonly string[],
): string[] {
  const out: string[] = [];
  for (const date of dates) {
    for (const slot of slotsBst) {
      out.push(bstKickoffIso(date, slot));
    }
  }
  return out;
}

export function formatWcKickoff(iso: string): { date: string; time: string } {
  const d = new Date(iso);
  return {
    date: DATE_FORMATTER.format(d),
    time: formatLocalKickoffTime(iso),
  };
}

/** GW1 · four evening slots per day (Fri–Sun). */
export const GW1_KICKOFF_SLOTS_BST = [
  "18:00",
  "19:30",
  "20:30",
  "21:30",
] as const;

/** GW2/GW3 · six evening slots per day (Sat–Sun). */
export const WEEKEND_KICKOFF_SLOTS_BST = [
  "18:00",
  "18:45",
  "19:30",
  "20:15",
  "21:00",
  "21:45",
] as const;
