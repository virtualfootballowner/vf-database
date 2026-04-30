import fs from "node:fs";
import path from "node:path";

export type EventType =
  | "Goal"
  | "Assist"
  | "MOTM"
  | "OG"
  | "Yellow Card"
  | "Red Card"
  | "FFT"
  | "No Stats";

export type MatchEventRecord = {
  matchId: string;
  type: EventType;
  team: string;
  player: string;
  robloxId: string | null;
  count: number;
  reason: string | null;
  notes: string;
};

const EVENT_TYPES: ReadonlySet<EventType> = new Set<EventType>([
  "Goal",
  "Assist",
  "MOTM",
  "OG",
  "Yellow Card",
  "Red Card",
  "FFT",
  "No Stats",
]);

function splitCSVLine(line: string): string[] {
  const out: string[] = [];
  let buf = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          buf += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        buf += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      out.push(buf);
      buf = "";
    } else {
      buf += ch;
    }
  }
  out.push(buf);
  return out.map((cell) => cell.trim());
}

function parseCSV(text: string): string[][] {
  return text
    .split(/\r?\n/)
    .filter((line) => line.length > 0)
    .map(splitCSVLine);
}

function readDataFile(filename: string): string {
  return fs.readFileSync(path.join(process.cwd(), "data", filename), "utf-8");
}

function normCell(s: string | undefined): string {
  return (s ?? "").trim() || "—";
}

function robloxCompatible(a: string | null, b: string | null): boolean {
  const x = a?.trim() || null;
  const y = b?.trim() || null;
  if (!x || !y) return true;
  return x === y;
}

function cardRowsMatch(
  a: Pick<MatchEventRecord, "matchId" | "type" | "team" | "player" | "robloxId">,
  b: Pick<MatchEventRecord, "matchId" | "type" | "team" | "player" | "robloxId">,
): boolean {
  if (a.type !== b.type) return false;
  if (a.matchId !== b.matchId) return false;
  if (normCell(a.team) !== normCell(b.team)) return false;
  if (normCell(a.player) !== normCell(b.player)) return false;
  return robloxCompatible(a.robloxId, b.robloxId);
}

/** Full event list from `match-events.csv` (all types) + `cards.csv` rows not already in the main file. */
export function readAllMatchEventRecords(): MatchEventRecord[] {
  const eventsCsv = readDataFile("match-events.csv");
  const cardsCsv = readDataFile("cards.csv");
  const events: MatchEventRecord[] = [];
  /** Multiset consumed when matching `cards.csv` lines to main-file cards */
  const mainCardPool: MatchEventRecord[] = [];

  const eventsRows = parseCSV(eventsCsv).slice(1);
  for (const row of eventsRows) {
    const [
      matchId,
      ,
      ,
      ,
      ,
      ,
      eventType,
      team,
      player,
      robloxId,
      countRaw,
      notes,
    ] = row;
    if (!matchId || !eventType) continue;
    if (!EVENT_TYPES.has(eventType as EventType)) continue;

    const teamNorm = normCell(team);
    const playerNorm = normCell(player);
    const rid = robloxId ? robloxId : null;
    const isCard = eventType === "Yellow Card" || eventType === "Red Card";
    const count = isCard
      ? 1
      : Number.parseInt(countRaw ?? "0", 10) || 0;

    const rec: MatchEventRecord = {
      matchId,
      type: eventType as EventType,
      team: teamNorm,
      player: playerNorm,
      robloxId: rid,
      count,
      reason: null,
      notes: notes ?? "",
    };
    events.push(rec);
    if (isCard) {
      mainCardPool.push({ ...rec });
    }
  }

  const cardsRows = parseCSV(cardsCsv).slice(1);
  for (const row of cardsRows) {
    const [matchId, team, player, robloxId, cardRaw, reason, notes] = row;
    if (!matchId || !cardRaw) continue;
    const cardType =
      cardRaw === "Red"
        ? "Red Card"
        : cardRaw === "Yellow"
          ? "Yellow Card"
          : null;
    if (!cardType) continue;
    const teamNorm = normCell(team);
    const playerNorm = normCell(player);
    const rid = robloxId ? robloxId : null;
    const candidate: MatchEventRecord = {
      matchId,
      type: cardType,
      team: teamNorm,
      player: playerNorm,
      robloxId: rid,
      count: 1,
      reason: reason || null,
      notes: notes ?? "",
    };
    const idx = mainCardPool.findIndex((m) => cardRowsMatch(m, candidate));
    if (idx >= 0) {
      mainCardPool.splice(idx, 1);
      continue;
    }
    events.push(candidate);
  }

  return events;
}
