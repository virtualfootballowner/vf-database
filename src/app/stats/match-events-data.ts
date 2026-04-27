import "server-only";

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

export type MatchEvent = {
  matchId: string;
  type: EventType;
  team: string;
  player: string;
  robloxId: string | null;
  count: number;
  reason: string | null;
  notes: string;
};

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

function loadAllEvents(): MatchEvent[] {
  const eventsCsv = readDataFile("match-events.csv");
  const cardsCsv = readDataFile("cards.csv");

  const events: MatchEvent[] = [];

  // Match Events: Match ID, Season, Competition, Home, Away, Score, Event Type, Team, Player, Roblox ID, Count, Notes
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

    const isCard = eventType === "Yellow Card" || eventType === "Red Card";
    if (isCard) {
      // Cards come from cards.csv (which carries reasons). Skip duplicates here.
      continue;
    }

    const count = Number.parseInt(countRaw ?? "0", 10) || 0;
    events.push({
      matchId,
      type: eventType as EventType,
      team: team || "—",
      player: player || "—",
      robloxId: robloxId ? robloxId : null,
      count,
      reason: null,
      notes: notes ?? "",
    });
  }

  // Cards: Match ID, Team, Player, Roblox ID, Card, Reason, Notes
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
    events.push({
      matchId,
      type: cardType,
      team: team || "—",
      player: player || "—",
      robloxId: robloxId ? robloxId : null,
      count: 1,
      reason: reason || null,
      notes: notes ?? "",
    });
  }

  return events;
}

let cache: MatchEvent[] | null = null;
function allEvents(): MatchEvent[] {
  if (!cache) cache = loadAllEvents();
  return cache;
}

export function getEventsForMatch(matchId: string): MatchEvent[] {
  return allEvents().filter((event) => event.matchId === matchId);
}
