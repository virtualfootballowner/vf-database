/**
 * Builds squad lists from match events: players with Goal/Assist in matches for a season
 * get `player_team_seasons` rows. Only players with a linked Roblox user id are included.
 *
 * Usage: tsx scripts/fill-season-squads-from-events.ts <season>
 * Example: tsx scripts/fill-season-squads-from-events.ts 2
 *
 * Prereq: matches imported; players with roblox_user_id for event participants.
 * Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import path from "node:path";

import { matches, resolveTeamForWebsiteName } from "../src/app/stats/matches-data";
import {
  readAllMatchEventRecords,
  type MatchEventRecord,
} from "../src/lib/match-event-records";

config({ path: path.resolve(process.cwd(), ".env.local"), override: true });

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const ROSTER_EVENT_TYPES = new Set<MatchEventRecord["type"]>(["Goal", "Assist"]);

async function resolvePlayerId(
  robloxUserId: string | null | undefined,
  username: string,
): Promise<string | null> {
  const rid = robloxUserId?.trim();
  if (rid) {
    const x = await supabase
      .from("players")
      .select("id")
      .eq("roblox_user_id", rid)
      .maybeSingle();
    if (!x.error && x.data?.id) return x.data.id;
  }
  const u = username.trim();
  if (!u || u === "—") return null;
  const y = await supabase
    .from("players")
    .select("id")
    .ilike("roblox_username", u)
    .not("roblox_user_id", "is", null)
    .maybeSingle();
  if (!y.error && y.data?.id) return y.data.id;
  return null;
}

const playerIdCache = new Map<string, string>();

async function resolvePlayerIdCached(
  robloxUserId: string | null | undefined,
  username: string,
): Promise<string | null> {
  const rid = robloxUserId?.trim();
  const cacheKey = rid ? `id:${rid}` : `u:${username.trim().toLowerCase()}`;
  const hit = playerIdCache.get(cacheKey);
  if (hit) return hit;
  const id = await resolvePlayerId(robloxUserId, username);
  if (id) playerIdCache.set(cacheKey, id);
  return id;
}

function membershipKey(
  playerId: string,
  teamSlug: string,
  season: number,
): string {
  return `${playerId}|${teamSlug}|${season}`;
}

async function main() {
  const seasonArg = Number.parseInt(process.argv[2] ?? "", 10);
  if (!Number.isFinite(seasonArg)) {
    console.error("Usage: tsx scripts/fill-season-squads-from-events.ts <season>");
    process.exit(1);
  }

  const season = seasonArg;
  const matchIds = new Set(
    matches.filter((m) => m.season === season).map((m) => m.id),
  );

  const events = readAllMatchEventRecords();
  const rosterPairs = new Map<string, true>();

  for (const e of events) {
    if (!matchIds.has(e.matchId)) continue;
    if (!ROSTER_EVENT_TYPES.has(e.type)) continue;
    const t = e.team?.trim();
    if (!t || t === "—") continue;
    const meta = resolveTeamForWebsiteName(t);
    const teamSlug = meta.slug?.trim();
    if (!teamSlug) {
      console.warn(`Skip: no slug for team “${t}” (${e.matchId} · ${e.type})`);
      continue;
    }

    const playerId = await resolvePlayerIdCached(e.robloxId, e.player);
    if (!playerId) {
      console.warn(`Skip: no Roblox-linked player for “${e.player}” (${e.matchId})`);
      continue;
    }

    rosterPairs.set(membershipKey(playerId, teamSlug, season), true);
  }

  const rows = [...rosterPairs.keys()].map((k) => {
    const parts = k.split("|");
    const playerId = parts[0]!;
    const teamSlug = parts[1]!;
    return {
      player_id: playerId,
      team_slug: teamSlug,
      season: season as number,
    };
  });

  console.log(
    `S${season} squad memberships to upsert: ${rows.length} (Goal/Assist, Roblox id only)`,
  );

  const chunkSize = 80;
  for (let i = 0; i < rows.length; i += chunkSize) {
    const batch = rows.slice(i, i + chunkSize);
    const { error } = await supabase.from("player_team_seasons").upsert(batch, {
      onConflict: "player_id,team_slug,season",
      ignoreDuplicates: false,
    });
    if (error) throw error;
  }

  const bySlug = new Map<string, number>();
  for (const r of rows) {
    bySlug.set(r.team_slug, (bySlug.get(r.team_slug) ?? 0) + 1);
  }
  const sorted = [...bySlug.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  console.log(`Players per team_slug (S${season}):`);
  for (const [slug, n] of sorted) {
    console.log(`  ${slug}: ${n}`);
  }
  console.log("Done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
