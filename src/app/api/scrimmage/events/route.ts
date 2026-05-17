import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";

import { autoFinalizeScrimmage } from "@/lib/scrimmage/auto-finalize";
import { isDiscordBanActive } from "@/lib/players/discord-ban";
import { createSupabaseServerClient } from "@/lib/supabase-server";

/**
 * Roblox → web event ingestion for FACEIT scrimmages.
 *
 * Auth model:
 *   x-vf-timestamp:  unix seconds (string)
 *   x-vf-signature:  hex(hmac_sha256(VF_SCRIMMAGE_INGEST_SECRET, `${ts}.${rawBody}`))
 *
 * Reject if timestamp older than 5 minutes (replay) or > 60s in the future.
 *
 * Body shape (batch — Roblox can send 1..N events per call, we recommend
 * batching every ~2s rather than one HTTP request per goal):
 *
 *   {
 *     "events": [
 *       {
 *         "external_event_id": "abc-123",   // unique-per-event in Roblox
 *         "type": "goal",                   // see docs/roblox-scrimmage-events.md
 *         "match_code": "SCR-2026-0003",
 *         "roblox_user_id": "12345678",
 *         "minute": 23,
 *         "details": { "assist_roblox_user_id": "87654321" },
 *         "occurred_at": "2026-05-06T01:23:45Z"
 *       }
 *     ]
 *   }
 *
 * Response:
 *   {
 *     "received": 1,
 *     "processed": 1,
 *     "results": [
 *       { "external_event_id": "abc-123", "status": "inserted",
 *         "event_id": "uuid", "match_id": "uuid", "player_resolved": true }
 *     ]
 *   }
 *
 * Per-event statuses: "inserted" | "duplicate" | "rejected"
 * `rejected` always carries a `reason` string.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BATCH = 50;
const MAX_TIMESTAMP_SKEW_SEC = 300; // 5 min

type IncomingEvent = {
  external_event_id?: string | null;
  type?: string;
  match_code?: string;
  roblox_user_id?: string | number;
  minute?: number | null;
  details?: Record<string, unknown> | null;
  occurred_at?: string | null;
};

type ResultEntry = {
  external_event_id: string | null;
  status: "inserted" | "duplicate" | "rejected";
  event_id?: string;
  match_id?: string;
  player_resolved?: boolean;
  reason?: string;
};

export async function POST(req: Request): Promise<Response> {
  const secret = process.env.VF_SCRIMMAGE_INGEST_SECRET;
  if (!secret) {
    console.error("[scrim-ingest] VF_SCRIMMAGE_INGEST_SECRET not configured");
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

  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return jsonError(400, "Body is not valid JSON.");
  }

  const events = extractEvents(body);
  if (!events) {
    return jsonError(400, "Body must be { events: [...] }.");
  }
  if (events.length === 0) {
    return NextResponse.json({ received: 0, processed: 0, results: [] });
  }
  if (events.length > MAX_BATCH) {
    return jsonError(413, `Batch too large: max ${MAX_BATCH} events per call.`);
  }

  // Resolve every match_code referenced in this batch up-front (one query).
  const matchCodes = [
    ...new Set(events.map((e) => (e.match_code ?? "").trim()).filter(Boolean)),
  ];
  const supabase = createSupabaseServerClient();
  const matchByCode = new Map<
    string,
    { id: string; matchCode: string; status: string }
  >();
  if (matchCodes.length > 0) {
    const { data, error } = await supabase
      .from("scrimmage_matches")
      .select("id, match_code, status")
      .in("match_code", matchCodes);
    if (error) {
      console.error("[scrim-ingest] match lookup failed:", error);
      return jsonError(500, "Database error.");
    }
    for (const row of (data ?? []) as {
      id: string;
      match_code: string;
      status: string;
    }[]) {
      matchByCode.set(row.match_code, {
        id: row.id,
        matchCode: row.match_code,
        status: row.status,
      });
    }
  }

  // Resolve every roblox_user_id referenced in this batch (one query).
  const robloxUserIds = [
    ...new Set(
      events.flatMap((e) => {
        const ids: string[] = [];
        const primary =
          e.roblox_user_id == null ? "" : String(e.roblox_user_id);
        if (primary) ids.push(primary);
        const assistRaw = e.details?.assist_roblox_user_id;
        if (assistRaw != null && String(assistRaw).trim())
          ids.push(String(assistRaw));
        return ids;
      }),
    ),
  ];
  type BanCheckRow = {
    id: string;
    roblox_user_id: string;
    discord_banned_at: string | null;
    discord_banned_until: string | null;
  };
  const playerByRoblox = new Map<string, string>();
  const bannedRoblox = new Set<string>();
  if (robloxUserIds.length > 0) {
    const { data } = await supabase
      .from("players")
      .select(
        "id, roblox_user_id, discord_banned_at, discord_banned_until",
      )
      .in("roblox_user_id", robloxUserIds);
    for (const row of (data ?? []) as BanCheckRow[]) {
      playerByRoblox.set(row.roblox_user_id, row.id);
      if (
        isDiscordBanActive({
          discord_banned_at: row.discord_banned_at,
          discord_banned_until: row.discord_banned_until,
        })
      ) {
        bannedRoblox.add(row.roblox_user_id);
      }
    }
  }

  const results: ResultEntry[] = [];
  let processed = 0;

  // Process events in order so match.start side-effects land before the
  // first goal event in the same batch.
  for (const ev of events) {
    const externalId = ev.external_event_id ?? null;
    const matchCode = (ev.match_code ?? "").trim();
    const eventType = (ev.type ?? "").trim();
    const robloxUserId =
      ev.roblox_user_id == null ? "" : String(ev.roblox_user_id);

    if (!matchCode || !eventType || !robloxUserId) {
      results.push({
        external_event_id: externalId,
        status: "rejected",
        reason: "Missing required field (match_code | type | roblox_user_id).",
      });
      continue;
    }

    const match = matchByCode.get(matchCode);
    if (!match) {
      results.push({
        external_event_id: externalId,
        status: "rejected",
        reason: `Unknown match_code: ${matchCode}`,
      });
      continue;
    }

    if (match.status === "completed" || match.status === "voided" || match.status === "cancelled") {
      results.push({
        external_event_id: externalId,
        status: "rejected",
        reason: `Match ${matchCode} is ${match.status}; cannot accept new events.`,
      });
      continue;
    }

    if (bannedRoblox.has(robloxUserId)) {
      results.push({
        external_event_id: externalId,
        status: "rejected",
        reason:
          "Primary player is banned from the league Discord — event blocked.",
      });
      continue;
    }

    const assistRaw = ev.details?.assist_roblox_user_id;
    if (assistRaw != null) {
      const assistId = String(assistRaw);
      if (assistId && bannedRoblox.has(assistId)) {
        results.push({
          external_event_id: externalId,
          status: "rejected",
          reason:
            "Assist player is banned from the league Discord — event blocked.",
        });
        continue;
      }
    }

    const playerId = playerByRoblox.get(robloxUserId) ?? null;

    // Insert event row.
    const insertPayload: Record<string, unknown> = {
      match_id: match.id,
      player_id: playerId,
      roblox_user_id: robloxUserId,
      event_type: eventType,
      minute: typeof ev.minute === "number" ? ev.minute : null,
      details: (ev.details ?? {}) as Record<string, unknown>,
      occurred_at: typeof ev.occurred_at === "string" ? ev.occurred_at : null,
      external_event_id: externalId,
      source: "roblox",
    };

    const { data: ins, error: insErr } = await supabase
      .from("scrimmage_match_events")
      .insert(insertPayload)
      .select("id")
      .single();

    if (insErr) {
      // Unique constraint on (match_id, external_event_id) → idempotent retry.
      if (insErr.code === "23505") {
        results.push({
          external_event_id: externalId,
          status: "duplicate",
          match_id: match.id,
          player_resolved: playerId !== null,
        });
        continue;
      }
      console.error("[scrim-ingest] insert failed:", insErr, insertPayload);
      results.push({
        external_event_id: externalId,
        status: "rejected",
        reason: `DB error: ${insErr.message}`,
      });
      continue;
    }

    // Side-effects for lifecycle events.
    if (eventType === "match_start") {
      const patch: Record<string, unknown> = {
        roblox_started_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      const placeId = ev.details?.["roblox_place_id"];
      const jobId = ev.details?.["roblox_job_id"];
      if (typeof placeId === "string" || typeof placeId === "number") {
        patch.roblox_place_id = String(placeId);
      }
      if (typeof jobId === "string") {
        patch.roblox_job_id = jobId;
      }
      // Bump status to 'live' if it isn't already (e.g. ready_check held over).
      if (match.status !== "live") {
        patch.status = "live";
        patch.match_started_at = new Date().toISOString();
      }
      await supabase
        .from("scrimmage_matches")
        .update(patch)
        .eq("id", match.id);
    } else if (eventType === "match_end" || eventType === "fulltime") {
      await supabase
        .from("scrimmage_matches")
        .update({
          roblox_ended_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", match.id);
    }

    processed += 1;
    results.push({
      external_event_id: externalId,
      status: "inserted",
      event_id: (ins as { id: string }).id,
      match_id: match.id,
      player_resolved: playerId !== null,
    });
  }

  // ----------------------------------------------------------------
  // Auto-finalization step.
  //
  // Any match that received a `match_end` (or `fulltime`) event in this
  // batch is now eligible for auto-finalize. We do this AFTER all events
  // have been inserted so the goal counter sees every assist/goal/etc.
  // submitted in the same batch.
  //
  // Only one finalize per match per batch. A match that's already
  // `completed` from a prior request short-circuits inside autoFinalize.
  // ----------------------------------------------------------------
  const finalizingCodes = new Set<string>();
  for (const ev of events) {
    const t = (ev.type ?? "").trim();
    if (t === "match_end" || t === "fulltime") {
      const code = (ev.match_code ?? "").trim();
      if (code) finalizingCodes.add(code);
    }
  }
  const finalizeSummaries: Record<string, unknown>[] = [];
  for (const code of finalizingCodes) {
    const match = matchByCode.get(code);
    if (!match) continue;
    try {
      const out = await autoFinalizeScrimmage(supabase, {
        matchId: match.id,
        matchCode: match.matchCode,
      });
      finalizeSummaries.push({ match_code: code, ...out });
    } catch (err) {
      console.error(`[scrim-ingest] auto-finalize failed for ${code}:`, err);
      finalizeSummaries.push({
        match_code: code,
        ok: false,
        reason: err instanceof Error ? err.message : "auto-finalize crashed",
      });
    }
  }

  return NextResponse.json({
    received: events.length,
    processed,
    results,
    finalized: finalizeSummaries,
  });
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function extractEvents(body: unknown): IncomingEvent[] | null {
  if (!body || typeof body !== "object") return null;
  const events = (body as { events?: unknown }).events;
  if (!Array.isArray(events)) return null;
  return events as IncomingEvent[];
}

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

/** Reject GET / others to make integration mistakes obvious. */
export async function GET(): Promise<Response> {
  return jsonError(
    405,
    "POST only — see docs/roblox-scrimmage-events.md for the spec.",
  );
}
