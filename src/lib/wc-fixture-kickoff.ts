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

const BST_TIME_FORMATTER = new Intl.DateTimeFormat("en-US", {
  hour: "numeric",
  minute: "2-digit",
  timeZone: "Europe/London",
  timeZoneName: "short",
});

/** Display kickoff as `1:00 PM EDT / 6:00 PM BST` (US Eastern + UK). */
export function formatDualTimezoneKickoffTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return `${EST_TIME_FORMATTER.format(d)} / ${BST_TIME_FORMATTER.format(d)}`;
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
    time: formatDualTimezoneKickoffTime(iso),
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
