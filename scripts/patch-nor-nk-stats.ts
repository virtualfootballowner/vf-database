/**
 * S3-WC-G-F-02: Norway 7–0 North Korea — full goal/assist stats.
 * Usage: tsx scripts/patch-nor-nk-stats.ts
 */
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import path from "node:path";

config({ path: path.resolve(process.cwd(), ".env.local"), override: true });

const MATCH_CODE = "S3-WC-G-F-02";

const EVENTS: {
  username: string;
  teamSlug: string;
  eventType: "goal" | "assist";
  count: number;
}[] = [
  { username: "killzoneshade", teamSlug: "norway", eventType: "goal", count: 3 },
  { username: "yattorei", teamSlug: "norway", eventType: "goal", count: 2 },
  { username: "PSYKOO0O", teamSlug: "norway", eventType: "goal", count: 1 },
  { username: "ahttuso", teamSlug: "norway", eventType: "goal", count: 1 },
  { username: "alIiehayes", teamSlug: "norway", eventType: "assist", count: 3 },
  { username: "yattorei", teamSlug: "norway", eventType: "assist", count: 1 },
  { username: "killzoneshade", teamSlug: "norway", eventType: "assist", count: 2 },
  { username: "ahttuso", teamSlug: "norway", eventType: "assist", count: 1 },
];

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function resolvePlayer(username: string): Promise<{
  id: string;
  roblox_username: string;
  roblox_user_id: string | null;
}> {
  const { data, error } = await supabase
    .from("players")
    .select("id, roblox_username, roblox_user_id")
    .ilike("roblox_username", username)
    .limit(5);
  if (error) throw error;
  const exact = (data ?? []).find(
    (p) => p.roblox_username.toLowerCase() === username.toLowerCase(),
  );
  if (!exact) {
    throw new Error(`Player not found: ${username} (got ${JSON.stringify(data)})`);
  }
  return exact;
}

async function main(): Promise<void> {
  const { data: match, error: mErr } = await supabase
    .from("matches")
    .select("id, roblox_match_id, home_score, away_score")
    .eq("roblox_match_id", MATCH_CODE)
    .single();
  if (mErr || !match) throw mErr ?? new Error("Match not found");

  const { data: norway, error: tErr } = await supabase
    .from("teams")
    .select("id, slug, name")
    .eq("slug", "norway")
    .single();
  if (tErr || !norway) throw tErr ?? new Error("Norway team not found");

  const { error: delErr } = await supabase
    .from("match_events")
    .delete()
    .eq("match_id", match.id);
  if (delErr) throw delErr;

  // North Korea is home; Norway is away.
  const { error: updErr } = await supabase
    .from("matches")
    .update({
      home_score: 0,
      away_score: 7,
      status: "completed",
      fft: null,
    })
    .eq("id", match.id);
  if (updErr) throw updErr;

  const rows = [];
  for (const ev of EVENTS) {
    const player = await resolvePlayer(ev.username);
    const { data: team, error: teamErr } = await supabase
      .from("teams")
      .select("id")
      .eq("slug", ev.teamSlug)
      .single();
    if (teamErr || !team) throw teamErr ?? new Error(`Team ${ev.teamSlug} not found`);

    rows.push({
      match_id: match.id,
      player_id: player.id,
      team_id: team.id,
      event_type: ev.eventType,
      minute: null,
      details: {
        source: "manual_stats_patch",
        player: player.roblox_username,
        roblox_user_id: player.roblox_user_id,
        count: ev.count,
        notes: null,
      },
    });
  }

  const { error: insErr } = await supabase.from("match_events").insert(rows);
  if (insErr) throw insErr;

  console.log(
    "Run refresh_player_goal_assist_totals in SQL editor if career totals drift.",
  );

  const { data: verify, error: vErr } = await supabase
    .from("match_events")
    .select("event_type, details")
    .eq("match_id", match.id);
  if (vErr) throw vErr;

  console.log(`Patched ${MATCH_CODE}: Norway 7–0 North Korea`);
  console.log("Events:", JSON.stringify(verify, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
