import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import path from "node:path";

import { refreshTeamSeasonRecordsForSeason } from "../src/lib/league/team-season-records";

config({ path: path.resolve(process.cwd(), ".env.local"), override: true });

const FFT_WINS = [
  "S3-WC-G-C-05", // France 3-0 Somalia
  "S3-WC-G-D-05", // Belgium 3-0 Ukraine
  "S3-WC-G-B-05", // Spain 3-0 Greece
  "S3-WC-G-E-05", // Morocco 3-0 Netherlands
  "S3-WC-G-A-05", // Nigeria 3-0 Mexico
  "S3-WC-G-C-06", // Canada 3-0 USA
] as const;

async function applyFft(supabase: ReturnType<typeof createClient>, code: string) {
  const { data: match, error: mErr } = await supabase
    .from("matches")
    .select("id")
    .eq("roblox_match_id", code)
    .single();
  if (mErr || !match) throw mErr ?? new Error(`missing ${code}`);

  await supabase.from("match_events").delete().eq("match_id", match.id);

  const { data, error } = await supabase
    .from("matches")
    .update({
      home_score: 3,
      away_score: 0,
      status: "completed",
      fft: "Yes",
      ended_at: new Date().toISOString(),
    })
    .eq("roblox_match_id", code)
    .select("roblox_match_id, home_score, away_score, fft")
    .single();
  if (error) throw error;
  console.log("FFT", data);
}

async function applyGerMotm(supabase: ReturnType<typeof createClient>) {
  const code = "S3-WC-G-E-06";
  const { data: match, error: mErr } = await supabase
    .from("matches")
    .select("id, away_team_id")
    .eq("roblox_match_id", code)
    .single();
  if (mErr || !match) throw mErr ?? new Error("missing E-06");

  await supabase
    .from("match_events")
    .delete()
    .eq("match_id", match.id)
    .eq("event_type", "motm");

  const { data, error: uErr } = await supabase
    .from("matches")
    .update({
      home_score: 2,
      away_score: 8,
      status: "completed",
      fft: "No",
      ended_at: new Date().toISOString(),
    })
    .eq("roblox_match_id", code)
    .select("home_score, away_score, fft")
    .single();
  if (uErr) throw uErr;
  console.log("SUI-GER", data);

  const { data: players } = await supabase
    .from("players")
    .select("id, roblox_username, roblox_user_id")
    .ilike("roblox_username", "Gvidiasas");
  const player = (players ?? []).find(
    (p) => p.roblox_username.toLowerCase() === "gvidiasas",
  );
  if (!player) throw new Error("Gvidiasas not found");

  const { error: insErr } = await supabase.from("match_events").insert({
    match_id: match.id,
    player_id: player.id,
    team_id: match.away_team_id,
    event_type: "motm",
    minute: null,
    details: {
      source: "manual_stats_patch",
      player: player.roblox_username,
      roblox_user_id: player.roblox_user_id,
      count: 1,
      notes: "MOTM backfill MD3",
    },
  });
  if (insErr) throw insErr;
  console.log("MOTM", code, player.roblox_username);
}

async function main() {
  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  for (const code of FFT_WINS) {
    await applyFft(supabase, code);
  }
  await applyGerMotm(supabase);
  await refreshTeamSeasonRecordsForSeason(supabase, 3);
  console.log("Season 3 records refreshed");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
