import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";

import { autoFinalizeLeagueMatch } from "@/lib/league/auto-finalize";
import { isDiscordBanActive } from "@/lib/players/discord-ban";
import { createSupabaseServerClient } from "@/lib/supabase-server";

/**
 * Roblox → web event ingestion for VF League fixtures (World Cup, etc.).
 *
 * Auth: same HMAC headers as scrimmage ingest
 *   x-vf-timestamp + x-vf-signature over `${ts}.${rawBody}`
 * Secret: VF_LEAGUE_INGEST_SECRET, falling back to VF_SCRIMMAGE_INGEST_SECRET.
 *
 * Body:
 *   { "events": [{ "external_event_id", "type", "roblox_match_id", "roblox_user_id", ... }] }
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BATCH = 50;
const MAX_TIMESTAMP_SKEW_SEC = 300;

const LEAGUE_EVENT_TYPES = new Set([
  "goal",
  "assist",
  "own_goal",
  "yellow_card",
  "red_card",
  "motm",
  "match_start",
  "match_end",
  "fulltime",
]);

type IncomingEvent = {
  external_event_id?: string | null;
  type?: string;
  roblox_match_id?: string;
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
  const secret =
    process.env.VF_LEAGUE_INGEST_SECRET?.trim() ||
    process.env.VF_SCRIMMAGE_INGEST_SECRET?.trim();
  if (!secret) {
    console.error("[league-ingest] ingest secret not configured");
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
  if (!events) return jsonError(400, "Body must be { events: [...] }.");
  if (events.length === 0) {
    return NextResponse.json({ received: 0, processed: 0, results: [] });
  }
  if (events.length > MAX_BATCH) {
    return jsonError(413, `Batch too large: max ${MAX_BATCH} events per call.`);
  }

  const robloxMatchIds = [
    ...new Set(
      events.map((e) => (e.roblox_match_id ?? "").trim()).filter(Boolean),
    ),
  ];
  const supabase = createSupabaseServerClient();
  const matchByRobloxId = new Map<
    string,
    {
      id: string;
      robloxMatchId: string;
      status: string;
      home_team_id: string;
      away_team_id: string;
      season: number;
    }
  >();

  if (robloxMatchIds.length > 0) {
    const { data, error } = await supabase
      .from("matches")
      .select(
        "id, roblox_match_id, status, home_team_id, away_team_id, season",
      )
      .in("roblox_match_id", robloxMatchIds);
    if (error) {
      console.error("[league-ingest] match lookup failed:", error);
      return jsonError(500, "Database error.");
    }
    for (const row of data ?? []) {
      const rid = row.roblox_match_id?.trim();
      if (!rid) continue;
      matchByRobloxId.set(rid, {
        id: row.id,
        robloxMatchId: rid,
        status: row.status,
        home_team_id: row.home_team_id,
        away_team_id: row.away_team_id,
        season: row.season,
      });
    }
  }

  const robloxUserIds = [
    ...new Set(
      events
        .map((e) => (e.roblox_user_id == null ? "" : String(e.roblox_user_id)))
        .filter(Boolean),
    ),
  ];

  type PlayerRow = {
    id: string;
    roblox_user_id: string;
    roblox_username: string;
    discord_banned_at: string | null;
    discord_banned_until: string | null;
  };
  const playerByRoblox = new Map<string, PlayerRow>();
  const bannedRoblox = new Set<string>();
  if (robloxUserIds.length > 0) {
    const { data } = await supabase
      .from("players")
      .select(
        "id, roblox_user_id, roblox_username, discord_banned_at, discord_banned_until",
      )
      .in("roblox_user_id", robloxUserIds);
    for (const row of (data ?? []) as PlayerRow[]) {
      playerByRoblox.set(row.roblox_user_id, row);
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

  const rosterCache = new Map<string, Set<string>>();

  async function rosterSlugs(playerId: string, season: number): Promise<Set<string>> {
    const key = `${playerId}:${season}`;
    if (rosterCache.has(key)) return rosterCache.get(key)!;
    const { data } = await supabase
      .from("player_team_seasons")
      .select("team_slug")
      .eq("player_id", playerId)
      .eq("season", season);
    const slugs = new Set(
      (data ?? [])
        .map((r) => r.team_slug?.trim())
        .filter((s): s is string => Boolean(s)),
    );
    rosterCache.set(key, slugs);
    return slugs;
  }

  const results: ResultEntry[] = [];
  let processed = 0;

  for (const ev of events) {
    const externalId = ev.external_event_id ?? null;
    const robloxMatchId = (ev.roblox_match_id ?? "").trim();
    const eventType = (ev.type ?? "").trim().toLowerCase();
    const robloxUserId =
      ev.roblox_user_id == null ? "" : String(ev.roblox_user_id);

    if (!robloxMatchId || !eventType) {
      results.push({
        external_event_id: externalId,
        status: "rejected",
        reason: "Missing required field (roblox_match_id | type).",
      });
      continue;
    }

    if (!LEAGUE_EVENT_TYPES.has(eventType)) {
      results.push({
        external_event_id: externalId,
        status: "rejected",
        reason: `Unsupported event type: ${eventType}`,
      });
      continue;
    }

    const match = matchByRobloxId.get(robloxMatchId);
    if (!match) {
      results.push({
        external_event_id: externalId,
        status: "rejected",
        reason: `Unknown roblox_match_id: ${robloxMatchId}`,
      });
      continue;
    }

    const lifecycleOnly =
      eventType === "match_start" ||
      eventType === "match_end" ||
      eventType === "fulltime";

    if (
      !lifecycleOnly &&
      match.status === "completed" &&
      eventType !== "match_end" &&
      eventType !== "fulltime"
    ) {
      results.push({
        external_event_id: externalId,
        status: "rejected",
        reason: `Match ${robloxMatchId} is completed; cannot accept new events.`,
      });
      continue;
    }

    if (!lifecycleOnly && !robloxUserId) {
      results.push({
        external_event_id: externalId,
        status: "rejected",
        reason: "Missing roblox_user_id for player event.",
      });
      continue;
    }

    if (robloxUserId && bannedRoblox.has(robloxUserId)) {
      results.push({
        external_event_id: externalId,
        status: "rejected",
        reason: "Player is banned from VF League — event blocked.",
      });
      continue;
    }

    const player = robloxUserId
      ? playerByRoblox.get(robloxUserId) ?? null
      : null;
    let teamId: string | null = null;
    if (player && !lifecycleOnly) {
      const slugs = await rosterSlugs(player.id, match.season);
      const { data: teams } = await supabase
        .from("teams")
        .select("id, slug")
        .in("id", [match.home_team_id, match.away_team_id]);
      for (const t of teams ?? []) {
        const slug = t.slug?.trim();
        if (!slug || !slugs.has(slug)) continue;
        teamId = t.id;
        break;
      }
    }

    const details: Record<string, unknown> = {
      ...(ev.details ?? {}),
      source: "roblox_league_ingest",
      roblox_user_id: robloxUserId || null,
      player: player?.roblox_username ?? null,
      count: 1,
    };

    if (eventType === "match_start") {
      await supabase
        .from("matches")
        .update({ status: "live" })
        .eq("id", match.id)
        .eq("status", "scheduled");
      results.push({
        external_event_id: externalId,
        status: "inserted",
        match_id: match.id,
        player_resolved: false,
      });
      processed += 1;
      continue;
    }

    if (lifecycleOnly && (eventType === "match_end" || eventType === "fulltime")) {
      results.push({
        external_event_id: externalId,
        status: "inserted",
        match_id: match.id,
        player_resolved: false,
      });
      processed += 1;
      continue;
    }

    const { data: ins, error: insErr } = await supabase
      .from("match_events")
      .insert({
        match_id: match.id,
        player_id: player?.id ?? null,
        team_id: teamId,
        event_type: eventType,
        minute: typeof ev.minute === "number" ? ev.minute : null,
        details,
      })
      .select("id")
      .single();

    if (insErr) {
      console.error("[league-ingest] insert failed:", insErr);
      results.push({
        external_event_id: externalId,
        status: "rejected",
        reason: `DB error: ${insErr.message}`,
      });
      continue;
    }

    processed += 1;
    results.push({
      external_event_id: externalId,
      status: "inserted",
      event_id: (ins as { id: string }).id,
      match_id: match.id,
      player_resolved: player !== null,
    });
  }

  const finalizingIds = new Set<string>();
  for (const ev of events) {
    const t = (ev.type ?? "").trim().toLowerCase();
    if (t === "match_end" || t === "fulltime") {
      const rid = (ev.roblox_match_id ?? "").trim();
      const m = matchByRobloxId.get(rid);
      if (m) finalizingIds.add(m.id);
    }
  }

  const finalizeSummaries: Record<string, unknown>[] = [];
  for (const matchId of finalizingIds) {
    try {
      const out = await autoFinalizeLeagueMatch(supabase, matchId);
      finalizeSummaries.push(out);
    } catch (err) {
      console.error(`[league-ingest] auto-finalize failed for ${matchId}:`, err);
      finalizeSummaries.push({
        matchId,
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

function extractEvents(body: unknown): IncomingEvent[] | null {
  if (!body || typeof body !== "object") return null;
  const events = (body as { events?: unknown }).events;
  if (!Array.isArray(events)) return null;
  return events as IncomingEvent[];
}

function verifySignature(
  secret: string,
  ts: string,
  rawBody: string,
  sigHex: string,
): boolean {
  const expected = createHmac("sha256", secret)
    .update(`${ts}.${rawBody}`)
    .digest("hex");
  try {
    const a = Buffer.from(expected, "hex");
    const b = Buffer.from(sigHex, "hex");
    return a.length === b.length && timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

function jsonError(status: number, message: string): Response {
  return NextResponse.json({ error: message }, { status });
}
