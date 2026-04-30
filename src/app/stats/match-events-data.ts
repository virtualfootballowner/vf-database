import "server-only";

import {
  readAllMatchEventRecords,
  type MatchEventRecord,
} from "@/lib/match-event-records";

export type EventType = MatchEventRecord["type"];

export type MatchEvent = MatchEventRecord;

let cache: MatchEventRecord[] | null = null;
function allEvents(): MatchEventRecord[] {
  if (!cache) cache = readAllMatchEventRecords();
  return cache;
}

export function getEventsForMatch(matchId: string): MatchEvent[] {
  return allEvents().filter((event) => event.matchId === matchId);
}
