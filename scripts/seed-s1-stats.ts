/**
 * Seeds Supabase with Season 1 matches + match events from repo CSV/TS sources,
 * and upserts players who appear as goal scorers, assisters, or OG (own goals)
 * with Roblox ID when known.
 *
 * Prereq: apply `supabase/migrations/20260429120000_s1_matches_and_events.sql`
 * Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY in `.env.local`
 */
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import path from "node:path";

import { matches } from "../src/app/stats/matches-data";
import { readAllMatchEventRecords } from "../src/lib/match-event-records";

config({ path: path.resolve(process.cwd(), ".env.local"), override: true });

const supabaseUrl = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const PLAYER_STATS_TYPES = new Set(["Goal", "Assist", "OG"]);

const s1Matches = matches.filter((m) => m.season === 1);
const s1MatchIds = new Set(s1Matches.map((m) => m.id));

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    out.push(arr.slice(i, i + size));
  }
  return out;
}

async function main() {
  console.log(`Season 1 matches to upsert: ${s1Matches.length}`);

  const { error: delEvents } = await supabase
    .from("match_events")
    .delete()
    .eq("season", 1);
  if (delEvents) throw delEvents;

  const { error: delMatches } = await supabase.from("matches").delete().eq("season", 1);
  if (delMatches) throw delMatches;

  const matchRows = s1Matches.map((m) => ({
    id: m.id,
    season: m.season,
    competition: m.competition,
    game_week: m.gameWeek,
    played_on: m.date,
    home_team: m.homeTeam,
    home_slug: m.homeSlug,
    away_team: m.awayTeam,
    away_slug: m.awaySlug,
    home_score: m.homeScore,
    away_score: m.awayScore,
    stage: m.stage,
    fft: m.fft,
    referee: m.referee,
    notes: m.notes,
  }));

  for (const batch of chunk(matchRows, 40)) {
    const { error } = await supabase.from("matches").insert(batch);
    if (error) throw error;
  }
  console.log("Matches inserted.");

  const allEvents = readAllMatchEventRecords();
  const s1Events = allEvents.filter((e) => s1MatchIds.has(e.matchId));

  const eventRows = s1Events.map((e) => ({
    match_id: e.matchId,
    season: 1,
    event_type: e.type,
    team: e.team,
    player: e.player,
    roblox_user_id: e.robloxId && e.robloxId.trim() !== "" ? e.robloxId.trim() : null,
    count: e.count,
    reason: e.reason,
    notes: e.notes,
  }));

  for (const batch of chunk(eventRows, 200)) {
    const { error } = await supabase.from("match_events").insert(batch);
    if (error) throw error;
  }
  console.log(`Match events inserted: ${eventRows.length}`);

  const merged = new Map<
    string,
    { username: string; robloxUserId: string | null }
  >();

  for (const e of s1Events) {
    if (!PLAYER_STATS_TYPES.has(e.type) || e.count <= 0) continue;
    const name = e.player?.trim();
    if (!name || name === "—") continue;
    const rid = e.robloxId?.trim() || null;
    const key = rid ? `id:${rid}` : `name:${name.toLowerCase()}`;
    const cur = merged.get(key);
    if (!cur) {
      merged.set(key, { username: name, robloxUserId: rid });
    } else if (rid && !cur.robloxUserId) {
      merged.set(key, { username: name, robloxUserId: rid });
    }
  }

  const lowerToRobloxId = new Map<string, string>();
  for (const v of merged.values()) {
    if (v.robloxUserId) {
      lowerToRobloxId.set(v.username.toLowerCase(), v.robloxUserId);
    }
  }

  for (const key of merged.keys()) {
    if (!key.startsWith("name:")) continue;
    const lower = key.slice("name:".length);
    if (lowerToRobloxId.has(lower)) {
      merged.delete(key);
    }
  }

  let inserted = 0;
  let skipped = 0;

  for (const { username, robloxUserId } of merged.values()) {
    if (robloxUserId) {
      const existing = await supabase
        .from("players")
        .select("id")
        .eq("roblox_user_id", robloxUserId)
        .limit(1)
        .maybeSingle();

      if (existing.error) throw existing.error;
      if (existing.data?.id) {
        skipped++;
        continue;
      }

      const ins = await supabase.from("players").insert({
        roblox_username: username,
        roblox_user_id: robloxUserId,
        discord_id: null,
        discord_username: null,
        player_source: "stats_csv_s1",
      });
      if (ins.error) throw ins.error;
      inserted++;
    }
  }

  console.log(
    `Players (Roblox id only): ${[...merged.values()].filter((v) => v.robloxUserId).length} profiles with ids; inserted ${inserted}, skipped ${skipped} (already present). Name-only rows are not created.`,
  );
  console.log("Done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
