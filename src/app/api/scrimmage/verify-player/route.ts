import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";

import { createSupabaseServerClient } from "@/lib/supabase-server";
import { isDiscordBanActive } from "@/lib/players/discord-ban";

/**
 * Roblox calls this endpoint when a player joins the VF lobby place
 * (or the reserved match server) to ask:
 *
 *   "Is this Roblox user allowed in match SCR-XXXX, what's their role
 *    (captain | player), and which team are they on?"
 *
 * Used to:
 *   - Kick anyone who isn't on the roster (it's a private match).
 *   - Auto-grant in-game admin commands to the two captains.
 *   - Auto-assign players to their drafted team on spawn.
 *   - Surface the reserved-server access code so the lobby place can
 *     teleport the player straight to the right private server.
 *
 * Auth scheme (same as POST /api/scrimmage/events; reusing the secret
 * keeps the dev's signing helper stubs single-purpose):
 *
 *   x-vf-timestamp:  unix seconds (string)
 *   x-vf-signature:  hex(hmac_sha256(SECRET, `${ts}.GET\n${path_with_query}`))
 *
 * `path_with_query` is the request URL's pathname + search, e.g.
 *   "/api/scrimmage/verify-player?match_code=SCR-2026-0001&roblox_user_id=12345678"
 *
 * Reject if timestamp is older than 5 minutes (replay window) or > 60s
 * in the future. Constant-time signature compare. No body.
 *
 * Response (200):
 *   {
 *     "authorized": true,
 *     "role": "captain" | "player",
 *     "team": 1 | 2,
 *     "match_code": "SCR-2026-0001",
 *     "match_id": "uuid",
 *     "status": "ready_check" | "live" | ...,
 *     "reserved_server_code": "abcdef..." | null,
 *     "private_server_id": "uuid" | null,
 *     "main_place_id": "12345" | null
 *   }
 *
 * Response (200) when not on the roster:
 *   { "authorized": false, "reason": "...", "match_code": "SCR-..." }
 *
 * Response (4xx) for auth / parameter problems.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_TIMESTAMP_SKEW_SEC = 300;

export async function GET(req: Request): Promise<Response> {
  const secret = process.env.VF_SCRIMMAGE_INGEST_SECRET;
  if (!secret) {
    return jsonError(503, "Verification not configured on this deployment.");
  }

  const ts = req.headers.get("x-vf-timestamp");
  const sig = req.headers.get("x-vf-signature");
  if (!ts || !sig) {
    return jsonError(401, "Missing x-vf-timestamp or x-vf-signature header.");
  }
  const tsNum = Number.parseInt(ts, 10);
  if (!Number.isFinite(tsNum)) {
    return jsonError(401, "Invalid x-vf-timestamp.");
  }
  const nowSec = Math.floor(Date.now() / 1000);
  if (Math.abs(nowSec - tsNum) > MAX_TIMESTAMP_SKEW_SEC) {
    return jsonError(401, "Timestamp outside acceptable window.");
  }

  const u = new URL(req.url);
  const pathWithQuery = `${u.pathname}${u.search}`;
  if (!verifySignature(secret, ts, `GET\n${pathWithQuery}`, sig)) {
    return jsonError(401, "Bad signature.");
  }

  const matchCode = (u.searchParams.get("match_code") ?? "").trim();
  const robloxUserId = (u.searchParams.get("roblox_user_id") ?? "").trim();
  if (!matchCode || !robloxUserId) {
    return jsonError(
      400,
      "Required query params: match_code and roblox_user_id.",
    );
  }

  const supabase = createSupabaseServerClient();

  const { data: matchRow, error: matchErr } = await supabase
    .from("scrimmage_matches")
    .select(
      "id, match_code, status, reserved_server_code, private_server_id, roblox_place_id, team1_captain_id, team2_captain_id",
    )
    .eq("match_code", matchCode)
    .maybeSingle();
  if (matchErr) {
    console.error("[scrim-verify] match lookup failed:", matchErr);
    return jsonError(500, "Database error.");
  }
  if (!matchRow) {
    return jsonOk({
      authorized: false,
      reason: `Unknown match_code: ${matchCode}`,
      match_code: matchCode,
    });
  }
  const match = matchRow as {
    id: string;
    match_code: string;
    status: string;
    reserved_server_code: string | null;
    private_server_id: string | null;
    roblox_place_id: string | null;
    team1_captain_id: string | null;
    team2_captain_id: string | null;
  };

  // Resolve the roblox_user_id → players.id once for both the captain
  // check and the team-roster lookup.
  const { data: playerRow } = await supabase
    .from("players")
    .select("id, discord_banned_at, discord_banned_until")
    .eq("roblox_user_id", robloxUserId)
    .maybeSingle();
  const player = playerRow as {
    id: string;
    discord_banned_at: string | null;
    discord_banned_until: string | null;
  } | null;

  if (!player) {
    return jsonOk({
      authorized: false,
      reason: "Roblox user is not linked to a VF profile.",
      match_code: matchCode,
      match_id: match.id,
      status: match.status,
    });
  }

  const playerId = player.id;

  if (
    isDiscordBanActive({
      discord_banned_at: player.discord_banned_at,
      discord_banned_until: player.discord_banned_until,
    })
  ) {
    return jsonOk({
      authorized: false,
      reason: "Player is banned from the league Discord.",
      match_code: matchCode,
      match_id: match.id,
      status: match.status,
    });
  }

  // Look up their roster row for this match. is_captain + team come
  // straight off scrimmage_players.
  const { data: rosterRow } = await supabase
    .from("scrimmage_players")
    .select("team, is_captain")
    .eq("match_id", match.id)
    .eq("player_id", playerId)
    .maybeSingle();
  const roster = rosterRow as { team: 1 | 2; is_captain: boolean } | null;

  if (!roster) {
    return jsonOk({
      authorized: false,
      reason: "Player is not on the roster for this match.",
      match_code: matchCode,
      match_id: match.id,
      status: match.status,
    });
  }

  return jsonOk({
    authorized: true,
    role: roster.is_captain ? "captain" : "player",
    team: roster.team,
    match_code: match.match_code,
    match_id: match.id,
    status: match.status,
    reserved_server_code: match.reserved_server_code,
    private_server_id: match.private_server_id,
    main_place_id: match.roblox_place_id,
  });
}

export async function POST(): Promise<Response> {
  return jsonError(
    405,
    "GET only — see docs/roblox-scrimmage-events.md for the spec.",
  );
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function verifySignature(
  secret: string,
  timestamp: string,
  payload: string,
  providedHex: string,
): boolean {
  const expected = createHmac("sha256", secret)
    .update(`${timestamp}.${payload}`)
    .digest("hex");
  if (expected.length !== providedHex.length) return false;
  try {
    return timingSafeEqual(
      Buffer.from(expected, "hex"),
      Buffer.from(providedHex, "hex"),
    );
  } catch {
    return false;
  }
}

function jsonOk(body: Record<string, unknown>): Response {
  return NextResponse.json(body);
}

function jsonError(status: number, message: string): Response {
  return NextResponse.json({ error: message }, { status });
}
