const LONDON = "Europe/London";

const DISPLAY_FORMATTER = new Intl.DateTimeFormat("en-US", {
  weekday: "long",
  month: "long",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZone: LONDON,
});

const LOG_FORMATTER = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZone: LONDON,
});

export function formatFixtureWhen(iso: string | null | undefined): string {
  if (!iso) return "TBD";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "TBD";
  return DISPLAY_FORMATTER.format(d);
}

export function formatDenialWhen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return LOG_FORMATTER.format(d);
}

/** Parse YYYY-MM-DD + flexible clock string in Europe/London → UTC ISO. */
export function parseProposedDateTime(
  dateRaw: string,
  timeRaw: string,
): { ok: true; iso: string } | { ok: false; message: string } {
  const dateMatch = dateRaw.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!dateMatch) {
    return {
      ok: false,
      message:
        "Use **YYYY-MM-DD** for the date (e.g. `2026-07-06`). Times are interpreted in **UK (London)**.",
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
        "Could not parse the time. Use **17:00** or **5:00 PM** (UK / London time).",
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

  const hh = String(hour).padStart(2, "0");
  const mm = String(minute).padStart(2, "0");

  const probe = new Date(`${y}-${mo}-${d}T12:00:00Z`);
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: LONDON,
    timeZoneName: "shortOffset",
  }).formatToParts(probe);
  const offsetPart = parts.find((p) => p.type === "timeZoneName")?.value ?? "GMT";
  const offsetMatch = offsetPart.match(/GMT([+-]\d{1,2})(?::(\d{2}))?/);
  let offset = "+00:00";
  if (offsetMatch) {
    const sign = offsetMatch[1]!.startsWith("-") ? "-" : "+";
    const oh = Math.abs(Number.parseInt(offsetMatch[1]!, 10));
    const om = offsetMatch[2] ? Number.parseInt(offsetMatch[2], 10) : 0;
    offset = `${sign}${String(oh).padStart(2, "0")}:${String(om).padStart(2, "0")}`;
  } else if (offsetPart.includes("+1")) {
    offset = "+01:00";
  }

  const iso = new Date(`${y}-${mo}-${d}T${hh}:${mm}:00${offset}`).toISOString();
  if (Number.isNaN(new Date(iso).getTime())) {
    return { ok: false, message: "That date/time combination is not valid." };
  }

  if (new Date(iso).getTime() <= Date.now()) {
    return {
      ok: false,
      message: "The proposed kickoff must be **in the future**.",
    };
  }

  return { ok: true, iso };
}

export function formatCaseNumber(caseNumber: number): string {
  return String(caseNumber).padStart(4, "0");
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
