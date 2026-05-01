/**
 * Appends S1 team honors to `players.trophies` for anyone on the winning squads
 * (from `player_team_seasons`). Only players with a non-null Roblox user id are updated.
 * Idempotent: skips if the same title + season + team name is already present.
 *
 * Honors follow `team_season_honors` for Season 1:
 *   - andover-fc → EuroLeague champions
 *   - milton-town-fc → Euroblox Cup champions
 *
 * Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 * Run: npm run db:award:s1-trophies
 */
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import path from "node:path";

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

const SEASON = 1 as const;

type Trophy = { title: string; season?: number; team?: string };

const SLUGS = ["andover-fc", "milton-town-fc"] as const;

const SLUG_TO_TITLE: Record<(typeof SLUGS)[number], string> = {
  "andover-fc": "EuroLeague champions",
  "milton-town-fc": "Euroblox Cup champions",
};

function trophyKey(t: Trophy): string {
  return `${t.title.toLowerCase()}|${t.season ?? ""}|${(t.team ?? "").toLowerCase()}`;
}

function parseTrophies(raw: unknown): Trophy[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (x): x is Trophy =>
      x != null &&
      typeof x === "object" &&
      typeof (x as Trophy).title === "string",
  );
}

function mergeTrophy(existing: unknown, add: Trophy): Trophy[] {
  const list = parseTrophies(existing);
  const k = trophyKey(add);
  if (list.some((t) => trophyKey(t) === k)) return list;
  return [...list, add];
}

async function main() {
  for (const slug of SLUGS) {
    const title = SLUG_TO_TITLE[slug];

    const { data: teamRow, error: teamErr } = await supabase
      .from("teams")
      .select("name")
      .eq("slug", slug)
      .maybeSingle();
    if (teamErr) throw teamErr;
    const teamName = teamRow?.name?.trim() || slug;

    const { data: links, error: linkErr } = await supabase
      .from("player_team_seasons")
      .select("player_id")
      .eq("team_slug", slug)
      .eq("season", SEASON);
    if (linkErr) throw linkErr;

    const playerIds = [
      ...new Set((links ?? []).map((r) => r.player_id).filter(Boolean)),
    ] as string[];
    if (playerIds.length === 0) {
      console.log(`${slug}: no S1 squad rows; skip.`);
      continue;
    }

    const { data: players, error: pErr } = await supabase
      .from("players")
      .select("id, trophies, roblox_user_id")
      .in("id", playerIds);
    if (pErr) throw pErr;

    const toAdd: Trophy = { title, season: SEASON, team: teamName };
    let updated = 0;
    let skipped = 0;

    for (const p of players ?? []) {
      const rid = p.roblox_user_id?.trim();
      if (!rid) {
        skipped++;
        continue;
      }
      const merged = mergeTrophy(p.trophies, toAdd);
      if (merged.length === parseTrophies(p.trophies).length) {
        skipped++;
        continue;
      }
      const { error: uErr } = await supabase
        .from("players")
        .update({ trophies: merged })
        .eq("id", p.id);
      if (uErr) throw uErr;
      updated++;
    }

    console.log(
      `${slug} (${teamName}): ${updated} players awarded “${title}”, ${skipped} skipped (no Roblox id or already had trophy).`,
    );
  }
  console.log("Done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
