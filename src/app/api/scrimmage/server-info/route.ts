import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";

import { createSupabaseServerClient } from "@/lib/supabase-server";

/**
 * Roblox lobby place POSTs here after it calls
 * `TeleportService:ReserveServer(MAIN_PLACE_ID)` to record the reserved
 * server's access code on the scrim row. Subsequent verify-player calls
 * for the same match return the cached code so every later joiner gets
 * teleported into the same instance.
 *
 * Auth (same scheme as POST /api/scrimmage/events):
 *   x-vf-timestamp:  unix seconds (string)
 *   x-vf-signature:  hex(hmac_sha256(SECRET, `${ts}.${rawBody}`))
 *
 * Body:
 *   {
 *     "match_code": "SCR-2026-0042",
 *     "reserved_server_code": "abcd1234...",   // required
 *     "private_server_id": "uuid",             // optional, informational
 *     "roblox_place_id": "12345",              // optional — main game placeId
 *     "roblox_job_id": "67890"                 // optional — jobId once it's running
 *   }
 *
 * Idempotency: if the row already has a reserved_server_code we return
 * 409 with the existing code so the lobby place can use it instead of
 * burning another reservation.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_TIMESTAMP_SKEW_SEC = 300;

type ServerInfoBody = {
  match_code?: string;
  reserved_server_code?: string;
  private_server_id?: string | null;
  roblox_place_id?: string | number | null;
  roblox_job_id?: string | null;
};

export async function POST(req: Request): Promise<Response> {
  const secret = process.env.VF_SCRIMMAGE_INGEST_SECRET;
  if (!secret) {
    return jsonError(503, "Ingestion not configured on this deployment.");
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

  const raw = await req.text();
  if (!verifySignature(secret, ts, raw, sig)) {
    return jsonError(401, "Bad signature.");
  }

  let body: ServerInfoBody;
  try {
    body = JSON.parse(raw) as ServerInfoBody;
  } catch {
    return jsonError(400, "Body is not valid JSON.");
  }

  const matchCode = (body.match_code ?? "").trim();
  const reservedCode = (body.reserved_server_code ?? "").trim();
  if (!matchCode || !reservedCode) {
    return jsonError(
      400,
      "Required fields: match_code, reserved_server_code.",
    );
  }

  const supabase = createSupabaseServerClient();

  const { data: existing, error: fetchErr } = await supabase
    .from("scrimmage_matches")
    .select("id, status, reserved_server_code, private_server_id")
    .eq("match_code", matchCode)
    .maybeSingle();
  if (fetchErr) {
    console.error("[scrim-server-info] fetch failed:", fetchErr);
    return jsonError(500, "Database error.");
  }
  if (!existing) {
    return jsonError(404, `Unknown match_code: ${matchCode}`);
  }
  const match = existing as {
    id: string;
    status: string;
    reserved_server_code: string | null;
    private_server_id: string | null;
  };

  if (match.status === "completed" || match.status === "voided") {
    return jsonError(
      409,
      `Match ${matchCode} is ${match.status}; cannot register a server.`,
    );
  }

  // Idempotency: if we already have a reserved code, return it instead
  // of overwriting. The lobby place should reuse this code rather than
  // create a fresh reservation.
  if (match.reserved_server_code && match.reserved_server_code !== reservedCode) {
    return NextResponse.json(
      {
        ok: false,
        already_reserved: true,
        reserved_server_code: match.reserved_server_code,
        private_server_id: match.private_server_id,
        message: "Match already has a reserved server; reuse this one.",
      },
      { status: 409 },
    );
  }

  const patch: Record<string, unknown> = {
    reserved_server_code: reservedCode,
    updated_at: new Date().toISOString(),
  };
  if (typeof body.private_server_id === "string" && body.private_server_id) {
    patch.private_server_id = body.private_server_id;
  }
  if (
    typeof body.roblox_place_id === "string" ||
    typeof body.roblox_place_id === "number"
  ) {
    patch.roblox_place_id = String(body.roblox_place_id);
  }
  if (typeof body.roblox_job_id === "string" && body.roblox_job_id) {
    patch.roblox_job_id = body.roblox_job_id;
  }

  const { error: updErr } = await supabase
    .from("scrimmage_matches")
    .update(patch)
    .eq("id", match.id);
  if (updErr) {
    console.error("[scrim-server-info] update failed:", updErr);
    return jsonError(500, "Database error while saving server info.");
  }

  return NextResponse.json({
    ok: true,
    match_code: matchCode,
    match_id: match.id,
    reserved_server_code: reservedCode,
  });
}

export async function GET(): Promise<Response> {
  return jsonError(
    405,
    "POST only — see docs/roblox-scrimmage-events.md for the spec.",
  );
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function verifySignature(
  secret: string,
  timestamp: string,
  rawBody: string,
  providedHex: string,
): boolean {
  const expected = createHmac("sha256", secret)
    .update(`${timestamp}.${rawBody}`)
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

function jsonError(status: number, message: string): Response {
  return NextResponse.json({ error: message }, { status });
}
