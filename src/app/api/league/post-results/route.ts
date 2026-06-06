import { NextResponse } from "next/server";

import { postLeagueResultsDiscord } from "@/lib/league/post-results-discord";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Internal hook: post a completed fixture embed to #results.
 * Auth: `Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>`
 */
export async function POST(req: Request): Promise<Response> {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  const cronSecret = process.env.CRON_SECRET?.trim();
  if (!serviceKey && !cronSecret) {
    return NextResponse.json(
      { error: "SUPABASE_SERVICE_ROLE_KEY or CRON_SECRET not configured" },
      { status: 500 },
    );
  }

  const auth = req.headers.get("authorization")?.trim();
  const allowed = new Set(
    [serviceKey, cronSecret].filter((v): v is string => Boolean(v)).map((v) => `Bearer ${v}`),
  );
  if (!auth || !allowed.has(auth)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const robloxMatchId =
    body &&
    typeof body === "object" &&
    "roblox_match_id" in body &&
    typeof (body as { roblox_match_id?: unknown }).roblox_match_id === "string"
      ? (body as { roblox_match_id: string }).roblox_match_id.trim()
      : "";
  const force = Boolean(
    body &&
      typeof body === "object" &&
      "force" in body &&
      (body as { force?: unknown }).force,
  );

  if (!robloxMatchId) {
    return NextResponse.json(
      { error: "roblox_match_id is required" },
      { status: 400 },
    );
  }

  const supabase = createSupabaseServerClient();
  const out = await postLeagueResultsDiscord(supabase, robloxMatchId, {
    force,
    submittedByTag: "VF auto-log",
  });

  if (!out.ok) {
    return NextResponse.json(out, { status: 500 });
  }

  return NextResponse.json(out);
}
