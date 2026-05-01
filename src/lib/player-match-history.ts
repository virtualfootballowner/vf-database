import "server-only";

import { matches as fileMatches } from "@/app/stats/matches-data";
import {
  readAllMatchEventRecords,
  type MatchEventRecord,
} from "@/lib/match-event-records";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export type PlayerMatchAppearance = {
  robloxMatchId: string;
  date: string;
  season: number;
  competition: string;
  gameWeek: string;
  homeTeam: string;
  awayTeam: string;
  homeSlug: string | null;
  awaySlug: string | null;
  homeScore: number;
  awayScore: number;
  fft: string;
  goals: number;
  assists: number;
  ownGoals: number;
  motm: boolean;
  yellowCards: number;
  redCards: number;
};

const FILE_MATCH_BY_ID = new Map(fileMatches.map((m) => [m.id, m] as const));

function normDetailCount(details: unknown): number {
  if (
    details &&
    typeof details === "object" &&
    !Array.isArray(details) &&
    "count" in details
  ) {
    const raw = (details as Record<string, unknown>).count;
    const n =
      typeof raw === "number"
        ? raw
        : Number.parseInt(String(raw ?? "").trim(), 10);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return 1;
}

function emptySummary() {
  return {
    goals: 0,
    assists: 0,
    ownGoals: 0,
    motm: false,
    yellowCards: 0,
    redCards: 0,
  };
}

type Summary = ReturnType<typeof emptySummary>;

function mergeDbEvent(summary: Summary, eventType: string, details: unknown) {
  const t = eventType.trim().toLowerCase();
  const c = normDetailCount(details);
  if (t === "goal") summary.goals += c;
  else if (t === "assist") summary.assists += c;
  else if (t === "own_goal") summary.ownGoals += c;
  else if (t === "motm") summary.motm = true;
  else if (t === "yellow_card") summary.yellowCards += c;
  else if (t === "red_card") summary.redCards += c;
}

function mergeFileEvent(summary: Summary, e: MatchEventRecord) {
  const t = e.type;
  const c = e.count > 0 ? e.count : 1;
  if (t === "Goal") summary.goals += c;
  else if (t === "Assist") summary.assists += c;
  else if (t === "OG") summary.ownGoals += c;
  else if (t === "MOTM") summary.motm = true;
  else if (t === "Yellow Card") summary.yellowCards += 1;
  else if (t === "Red Card") summary.redCards += 1;
}

function summaryLine(a: PlayerMatchAppearance): string | null {
  const parts: string[] = [];
  if (a.goals > 0) parts.push(`${a.goals}G`);
  if (a.assists > 0) parts.push(`${a.assists}A`);
  if (a.ownGoals > 0) parts.push(`${a.ownGoals} OG`);
  if (a.motm) parts.push("MOTM");
  if (a.yellowCards > 0)
    parts.push(`${a.yellowCards}× YC`);
  if (a.redCards > 0)
    parts.push(`${a.redCards}× RC`);
  return parts.length ? parts.join(" · ") : null;
}

export { summaryLine };

function sortAppearances(rows: PlayerMatchAppearance[]) {
  rows.sort((a, b) => {
    if (a.date !== b.date) return b.date.localeCompare(a.date);
    return a.robloxMatchId.localeCompare(b.robloxMatchId);
  });
  return rows;
}

async function loadFromSupabase(
  playerId: string,
): Promise<PlayerMatchAppearance[] | null> {
  try {
    const supabase = createSupabaseServerClient();
    const { data: events, error: evErr } = await supabase
      .from("match_events")
      .select("match_id, event_type, details")
      .eq("player_id", playerId);

    if (evErr || !events?.length) return null;

    const matchIds = [...new Set(events.map((e) => e.match_id))];
    const { data: matchRows, error: mErr } = await supabase
      .from("matches")
      .select(
        "id, roblox_match_id, scheduled_at, season, competition, game_week_label, match_week, home_score, away_score, fft, home_team_id, away_team_id",
      )
      .in("id", matchIds);

    if (mErr || !matchRows?.length) return null;

    const teamIds = new Set<string>();
    for (const m of matchRows) {
      teamIds.add(m.home_team_id);
      teamIds.add(m.away_team_id);
    }
    const { data: teamRows, error: tErr } = await supabase
      .from("teams")
      .select("id, name, slug")
      .in("id", [...teamIds]);

    if (tErr) return null;

    const teamById = new Map(
      (teamRows ?? []).map((t) => [t.id, t] as const),
    );

    const summaryByMatch = new Map<string, Summary>();
    for (const ev of events) {
      const m = ev.match_id;
      if (!summaryByMatch.has(m)) summaryByMatch.set(m, emptySummary());
      mergeDbEvent(
        summaryByMatch.get(m)!,
        String(ev.event_type),
        ev.details,
      );
    }

    const out: PlayerMatchAppearance[] = [];
    for (const m of matchRows) {
      const rid = m.roblox_match_id?.trim();
      if (!rid) continue;

      const ht = teamById.get(m.home_team_id);
      const at = teamById.get(m.away_team_id);
      if (!ht?.name || !at?.name) continue;

      const gw =
        m.game_week_label?.trim() ||
        (m.match_week != null ? `GW${m.match_week}` : "—");
      const day =
        m.scheduled_at == null ? "" : String(m.scheduled_at).slice(0, 10);
      const fftRaw = (m.fft ?? "No").trim() || "No";
      const summary = summaryByMatch.get(m.id) ?? emptySummary();

      out.push({
        robloxMatchId: rid,
        date: day,
        season: typeof m.season === "number" ? m.season : 0,
        competition: m.competition?.trim() || "—",
        gameWeek: gw,
        homeTeam: ht.name,
        awayTeam: at.name,
        homeSlug: ht.slug?.trim() || null,
        awaySlug: at.slug?.trim() || null,
        homeScore: m.home_score ?? 0,
        awayScore: m.away_score ?? 0,
        fft: fftRaw,
        ...summary,
      });
    }

    if (out.length === 0) return null;
    return sortAppearances(out);
  } catch {
    return null;
  }
}

function fileParticipationEvents(
  robloxUserId: string,
  robloxUsername: string,
): MatchEventRecord[] {
  const uid = robloxUserId.trim();
  const uname = robloxUsername.trim().toLowerCase();
  const all = readAllMatchEventRecords();
  return all.filter((e) => {
    if (e.type === "No Stats") return false;
    const p = e.player?.trim();
    if (!p || p === "—") return false;
    if (uid && e.robloxId?.trim() === uid) return true;
    return p.toLowerCase() === uname;
  });
}

function loadFromFile(
  robloxUserId: string,
  robloxUsername: string,
): PlayerMatchAppearance[] {
  const events = fileParticipationEvents(robloxUserId, robloxUsername);
  const byMatch = new Map<string, MatchEventRecord[]>();
  for (const e of events) {
    const arr = byMatch.get(e.matchId) ?? [];
    arr.push(e);
    byMatch.set(e.matchId, arr);
  }

  const out: PlayerMatchAppearance[] = [];
  for (const [matchId, evs] of byMatch) {
    const m = FILE_MATCH_BY_ID.get(matchId);
    if (!m) continue;

    const summary = emptySummary();
    for (const e of evs) mergeFileEvent(summary, e);

    out.push({
      robloxMatchId: m.id,
      date: m.date,
      season: m.season,
      competition: m.competition,
      gameWeek: m.gameWeek,
      homeTeam: m.homeTeam,
      awayTeam: m.awayTeam,
      homeSlug: m.homeSlug,
      awaySlug: m.awaySlug,
      homeScore: m.homeScore,
      awayScore: m.awayScore,
      fft: m.fft,
      ...summary,
    });
  }

  return sortAppearances(out);
}

export async function getPlayerMatchAppearances(args: {
  playerId: string;
  robloxUserId: string;
  robloxUsername: string;
}): Promise<PlayerMatchAppearance[]> {
  const fromDb = await loadFromSupabase(args.playerId);
  if (fromDb && fromDb.length > 0) return fromDb;
  return loadFromFile(args.robloxUserId, args.robloxUsername);
}
