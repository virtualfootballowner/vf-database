import type { SupabaseClient } from "@supabase/supabase-js";

import {
  parseDenialLog,
  type DenialLogEntry,
} from "@/bot/postpone/format";

export type UpcomingMatchRow = {
  id: string;
  season: number | null;
  competition: string | null;
  scheduled_at: string;
  home_team_id: string;
  away_team_id: string;
  home_slug: string;
  home_name: string;
  away_slug: string;
  away_name: string;
};

export type PostponementRequestRow = {
  id: string;
  case_number: number;
  match_id: string;
  guild_id: string;
  requester_discord_id: string;
  opponent_discord_id: string | null;
  requester_team_slug: string;
  opponent_team_slug: string;
  original_scheduled_at: string;
  proposed_scheduled_at: string;
  reason: string;
  status: string;
  opponent_dm_message_id: string | null;
  requester_dm_message_id: string | null;
  escalation_channel_id: string | null;
  escalation_message_id: string | null;
  staff_discord_id: string | null;
  staff_set_scheduled_at: string | null;
  expires_at: string;
  staff_ping_due_at: string | null;
  staff_last_ping_at: string | null;
  staff_resolved_at: string | null;
  created_at: string;
  updated_at: string;
};

export type PostponementLogEntry = PostponementRequestRow & {
  home_name: string;
  away_name: string;
  season: number | null;
  competition: string | null;
  denial_count: number;
  denial_log: DenialLogEntry[];
  original_locked: boolean;
};

export type PostponementStateRow = {
  match_id: string;
  denial_count: number;
  denial_log: DenialLogEntry[];
  original_locked: boolean;
};

const ACTIVE_STATUSES = ["pending_opponent", "escalated"] as const;

export type BlockingPostponementKind =
  | "awaiting_opponent_response"
  | "awaiting_your_response"
  | "escalated";

export type BlockingPostponement = {
  row: PostponementRequestRow;
  kind: BlockingPostponementKind;
};

function classifyBlockingPostponement(
  row: PostponementRequestRow,
  callerDiscordId: string,
  callerTeamSlug?: string | null,
): BlockingPostponement {
  if (row.status === "escalated") {
    return { row, kind: "escalated" };
  }
  if (row.opponent_discord_id === callerDiscordId) {
    return { row, kind: "awaiting_your_response" };
  }
  if (row.requester_discord_id === callerDiscordId) {
    return { row, kind: "awaiting_opponent_response" };
  }
  const teamSlug = callerTeamSlug?.trim();
  if (teamSlug) {
    if (row.opponent_team_slug === teamSlug) {
      return { row, kind: "awaiting_your_response" };
    }
    if (row.requester_team_slug === teamSlug) {
      return { row, kind: "awaiting_opponent_response" };
    }
  }
  return { row, kind: "awaiting_opponent_response" };
}

export async function fetchActiveRequestForMatch(
  supabase: SupabaseClient,
  matchId: string,
): Promise<PostponementRequestRow | null> {
  const { data, error } = await supabase
    .from("match_postponement_requests")
    .select("*")
    .eq("match_id", matchId)
    .in("status", [...ACTIVE_STATUSES])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data ? mapRequestRow(data) : null;
}

/** Blocks a second /postpone while either side has a pending request or staff escalation is open. */
export async function fetchBlockingPostponementForFixture(
  supabase: SupabaseClient,
  input: {
    matchId: string;
    homeSlug: string;
    awaySlug: string;
    callerDiscordId: string;
    callerTeamSlug?: string | null;
  },
): Promise<BlockingPostponement | null> {
  const byMatch = await fetchActiveRequestForMatch(supabase, input.matchId);
  if (byMatch) {
    return classifyBlockingPostponement(
      byMatch,
      input.callerDiscordId,
      input.callerTeamSlug,
    );
  }

  const slugs = [input.homeSlug, input.awaySlug];
  const { data, error } = await supabase
    .from("match_postponement_requests")
    .select("*")
    .in("status", [...ACTIVE_STATUSES])
    .in("requester_team_slug", slugs)
    .in("opponent_team_slug", slugs)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;
  return classifyBlockingPostponement(
    mapRequestRow(data),
    input.callerDiscordId,
    input.callerTeamSlug,
  );
}

export async function fetchTeamIdBySlug(
  supabase: SupabaseClient,
  slug: string,
): Promise<string | null> {
  const { data, error } = await supabase
    .from("teams")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw error;
  return (data as { id?: string } | null)?.id ?? null;
}

export type ResolveManagerDiscordResult =
  | { ok: true; discordId: string }
  | {
      ok: false;
      reason: "missing_row" | "no_manager" | "no_discord_link" | "ambiguous_player";
      managerDisplayName?: string;
    };

async function discordIdFromRobloxManagerName(
  supabase: SupabaseClient,
  robloxUsername: string,
): Promise<{ discordId: string | null; ambiguous: boolean }> {
  const name = robloxUsername.trim();
  if (!name) return { discordId: null, ambiguous: false };

  const { data, error } = await supabase
    .from("players")
    .select("discord_id")
    .ilike("roblox_username", name)
    .not("discord_id", "is", null);

  if (error) throw error;

  const ids = [
    ...new Set(
      (data ?? [])
        .map((row) => (row as { discord_id?: string | null }).discord_id?.trim())
        .filter((id): id is string => Boolean(id)),
    ),
  ];

  if (ids.length === 0) return { discordId: null, ambiguous: false };
  if (ids.length > 1) return { discordId: null, ambiguous: true };
  return { discordId: ids[0]!, ambiguous: false };
}

/** Discord id for DMs — uses `manager_discord_id`, then linked VF player by Roblox manager name. */
export async function resolveManagerDiscordId(
  supabase: SupabaseClient,
  teamSlug: string,
  season: number,
): Promise<ResolveManagerDiscordResult> {
  const { data, error } = await supabase
    .from("team_season_managers")
    .select("manager_discord_id, manager_display_name")
    .eq("team_slug", teamSlug)
    .eq("season", season)
    .maybeSingle();

  if (error) {
    const code = (error as { code?: string }).code;
    if (code === "42703" || code === "PGRST204") {
      return { ok: false, reason: "missing_row" };
    }
    throw error;
  }

  if (!data) return { ok: false, reason: "missing_row" };

  const row = data as {
    manager_discord_id?: string | null;
    manager_display_name?: string | null;
  };
  const storedDiscord = row.manager_discord_id?.trim();
  if (storedDiscord) return { ok: true, discordId: storedDiscord };

  const displayName = row.manager_display_name?.trim();
  if (!displayName) return { ok: false, reason: "no_manager" };

  const fromPlayer = await discordIdFromRobloxManagerName(supabase, displayName);
  if (fromPlayer.ambiguous) {
    return {
      ok: false,
      reason: "ambiguous_player",
      managerDisplayName: displayName,
    };
  }
  if (!fromPlayer.discordId) {
    return {
      ok: false,
      reason: "no_discord_link",
      managerDisplayName: displayName,
    };
  }

  const { error: backfillErr } = await supabase
    .from("team_season_managers")
    .update({ manager_discord_id: fromPlayer.discordId })
    .eq("team_slug", teamSlug)
    .eq("season", season);

  if (backfillErr) {
    console.warn(
      `[postpone] Could not backfill manager_discord_id for ${teamSlug} S${season}:`,
      backfillErr,
    );
  }

  return { ok: true, discordId: fromPlayer.discordId };
}

/** @deprecated Use {@link resolveManagerDiscordId} for richer errors. */
export async function fetchManagerDiscordId(
  supabase: SupabaseClient,
  teamSlug: string,
  season: number,
): Promise<string | null> {
  const resolved = await resolveManagerDiscordId(supabase, teamSlug, season);
  return resolved.ok ? resolved.discordId : null;
}

export async function fetchNextUpcomingMatchForTeam(
  supabase: SupabaseClient,
  teamId: string,
): Promise<UpcomingMatchRow | null> {
  const { data: match, error } = await supabase
    .from("matches")
    .select(
      "id, season, competition, scheduled_at, home_team_id, away_team_id",
    )
    .or(`home_team_id.eq.${teamId},away_team_id.eq.${teamId}`)
    .eq("status", "scheduled")
    .order("scheduled_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  if (!match) return null;

  const row = match as {
    id: string;
    season: number | null;
    competition: string | null;
    scheduled_at: string;
    home_team_id: string;
    away_team_id: string;
  };

  const { data: teams, error: teamErr } = await supabase
    .from("teams")
    .select("id, slug, name")
    .in("id", [row.home_team_id, row.away_team_id]);
  if (teamErr) throw teamErr;

  const byId = new Map(
    (teams ?? []).map((t) => [t.id as string, t as { id: string; slug: string; name: string }]),
  );
  const home = byId.get(row.home_team_id);
  const away = byId.get(row.away_team_id);
  if (!home || !away) return null;

  return {
    id: row.id,
    season: row.season,
    competition: row.competition,
    scheduled_at: row.scheduled_at,
    home_team_id: row.home_team_id,
    away_team_id: row.away_team_id,
    home_slug: home.slug,
    home_name: home.name,
    away_slug: away.slug,
    away_name: away.name,
  };
}

export async function fetchPostponementState(
  supabase: SupabaseClient,
  matchId: string,
): Promise<PostponementStateRow | null> {
  const { data, error } = await supabase
    .from("match_postponement_state")
    .select("match_id, denial_count, denial_log, original_locked")
    .eq("match_id", matchId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const row = data as {
    match_id: string;
    denial_count: number;
    denial_log: unknown;
    original_locked: boolean;
  };
  return {
    match_id: row.match_id,
    denial_count: row.denial_count,
    denial_log: parseDenialLog(row.denial_log),
    original_locked: row.original_locked,
  };
}

export async function fetchRequestById(
  supabase: SupabaseClient,
  requestId: string,
): Promise<PostponementRequestRow | null> {
  const { data, error } = await supabase
    .from("match_postponement_requests")
    .select("*")
    .eq("id", requestId)
    .maybeSingle();
  if (error) throw error;
  return data ? mapRequestRow(data) : null;
}

function mapRequestRow(data: Record<string, unknown>): PostponementRequestRow {
  return data as unknown as PostponementRequestRow;
}

export async function ensurePostponementState(
  supabase: SupabaseClient,
  matchId: string,
): Promise<PostponementStateRow> {
  const existing = await fetchPostponementState(supabase, matchId);
  if (existing) return existing;

  const { data, error } = await supabase
    .from("match_postponement_state")
    .insert({ match_id: matchId })
    .select("match_id, denial_count, denial_log, original_locked")
    .single();
  if (error) {
    if ((error as { code?: string }).code === "23505") {
      const retry = await fetchPostponementState(supabase, matchId);
      if (retry) return retry;
    }
    throw error;
  }
  const row = data as {
    match_id: string;
    denial_count: number;
    denial_log: unknown;
    original_locked: boolean;
  };
  return {
    match_id: row.match_id,
    denial_count: row.denial_count,
    denial_log: parseDenialLog(row.denial_log),
    original_locked: row.original_locked,
  };
}

export async function recordDenial(
  supabase: SupabaseClient,
  matchId: string,
  entry: DenialLogEntry,
): Promise<{ denialCount: number; log: DenialLogEntry[] }> {
  const state = await ensurePostponementState(supabase, matchId);
  const log = [...state.denial_log, entry];
  const denialCount = state.denial_count + 1;

  const { error } = await supabase
    .from("match_postponement_state")
    .update({
      denial_count: denialCount,
      denial_log: log,
      updated_at: new Date().toISOString(),
    })
    .eq("match_id", matchId);

  if (error) throw error;
  return { denialCount, log };
}

export async function appendDenialReason(
  supabase: SupabaseClient,
  matchId: string,
  deniedAt: string,
  reason: string,
): Promise<void> {
  const state = await ensurePostponementState(supabase, matchId);
  const log = state.denial_log.map((e) =>
    e.denied_at === deniedAt ? { ...e, reason } : e,
  );
  const { error } = await supabase
    .from("match_postponement_state")
    .update({ denial_log: log, updated_at: new Date().toISOString() })
    .eq("match_id", matchId);
  if (error) throw error;
}

export async function updateMatchScheduledAt(
  supabase: SupabaseClient,
  matchId: string,
  scheduledAt: string,
): Promise<void> {
  const { error } = await supabase
    .from("matches")
    .update({ scheduled_at: scheduledAt })
    .eq("id", matchId);
  if (error) throw error;

  await syncFixtureCatalogKickoff(supabase, matchId, scheduledAt);
}

/** Keep `fixtures.metadata` in sync so the website schedule reflects postponements. */
async function syncFixtureCatalogKickoff(
  supabase: SupabaseClient,
  matchId: string,
  scheduledAt: string,
): Promise<void> {
  const { data: matchRow, error: matchErr } = await supabase
    .from("matches")
    .select("roblox_match_id")
    .eq("id", matchId)
    .maybeSingle();
  if (matchErr) {
    console.warn("[postpone] fixture sync: match lookup failed:", matchErr);
    return;
  }

  const robloxMatchId = matchRow?.roblox_match_id?.trim() || null;
  const calendarDate = scheduledAt.slice(0, 10);
  const now = new Date().toISOString();

  let query = supabase.from("fixtures").select("id, metadata");
  if (robloxMatchId) {
    query = query.or(
      `match_id.eq.${matchId},roblox_match_id.eq.${robloxMatchId}`,
    );
  } else {
    query = query.eq("match_id", matchId);
  }

  const { data: rows, error: fxErr } = await query;
  if (fxErr) {
    console.warn("[postpone] fixture sync: list failed:", fxErr);
    return;
  }
  if (!rows?.length) return;

  for (const row of rows) {
    const prev =
      row.metadata &&
      typeof row.metadata === "object" &&
      !Array.isArray(row.metadata)
        ? (row.metadata as Record<string, unknown>)
        : {};
    const metadata = {
      ...prev,
      scheduled_at: scheduledAt,
      calendar_date: calendarDate,
    };
    const { error: upErr } = await supabase
      .from("fixtures")
      .update({ metadata, updated_at: now })
      .eq("id", row.id as string);
    if (upErr) {
      console.warn(`[postpone] fixture sync: update ${row.id} failed:`, upErr);
    }
  }
}

export async function lockOriginalKickoff(
  supabase: SupabaseClient,
  matchId: string,
): Promise<void> {
  await ensurePostponementState(supabase, matchId);
  const { error } = await supabase
    .from("match_postponement_state")
    .update({ original_locked: true, updated_at: new Date().toISOString() })
    .eq("match_id", matchId);
  if (error) throw error;
}

export async function fetchExpiredPendingRequests(
  supabase: SupabaseClient,
): Promise<PostponementRequestRow[]> {
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("match_postponement_requests")
    .select("*")
    .eq("status", "pending_opponent")
    .lt("expires_at", now);
  if (error) throw error;
  return (data ?? []).map(mapRequestRow);
}

export async function fetchEscalationsNeedingStaffPing(
  supabase: SupabaseClient,
): Promise<PostponementRequestRow[]> {
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("match_postponement_requests")
    .select("*")
    .eq("status", "escalated")
    .not("staff_ping_due_at", "is", null)
    .lte("staff_ping_due_at", now);
  if (error) throw error;
  return (data ?? []).map(mapRequestRow);
}

const POSTPONEMENT_LOG_STATUSES = [
  "pending_opponent",
  "accepted",
  "denied",
  "expired",
  "escalated",
  "staff_approved",
  "staff_force_original",
  "staff_set_time",
  "superseded",
] as const;

export type PostponementLogStatusFilter =
  (typeof POSTPONEMENT_LOG_STATUSES)[number];

export function isPostponementLogStatusFilter(
  value: string,
): value is PostponementLogStatusFilter {
  return (POSTPONEMENT_LOG_STATUSES as readonly string[]).includes(value);
}

export async function fetchPostponementLog(
  supabase: SupabaseClient,
  input: { status?: PostponementLogStatusFilter | null; limit?: number },
): Promise<PostponementLogEntry[]> {
  const limit = Math.min(Math.max(input.limit ?? 25, 1), 50);

  let query = supabase
    .from("match_postponement_requests")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (input.status) {
    query = query.eq("status", input.status);
  }

  const { data, error } = await query;
  if (error) throw error;

  const rows = (data ?? []).map(mapRequestRow);
  if (rows.length === 0) return [];

  const matchIds = [...new Set(rows.map((r) => r.match_id))];

  const { data: matches, error: matchErr } = await supabase
    .from("matches")
    .select("id, season, competition, home_team_id, away_team_id")
    .in("id", matchIds);
  if (matchErr) throw matchErr;

  const teamIds = new Set<string>();
  for (const m of matches ?? []) {
    const row = m as { home_team_id: string; away_team_id: string };
    teamIds.add(row.home_team_id);
    teamIds.add(row.away_team_id);
  }

  const teamNameById = new Map<string, string>();
  if (teamIds.size > 0) {
    const { data: teams, error: teamErr } = await supabase
      .from("teams")
      .select("id, name")
      .in("id", [...teamIds]);
    if (teamErr) throw teamErr;
    for (const t of teams ?? []) {
      teamNameById.set(
        (t as { id: string }).id,
        (t as { name: string }).name,
      );
    }
  }

  const matchById = new Map<
    string,
    {
      season: number | null;
      competition: string | null;
      home_name: string;
      away_name: string;
    }
  >();

  for (const m of matches ?? []) {
    const row = m as {
      id: string;
      season: number | null;
      competition: string | null;
      home_team_id: string;
      away_team_id: string;
    };
    const homeName = teamNameById.get(row.home_team_id) ?? row.home_team_id;
    const awayName = teamNameById.get(row.away_team_id) ?? row.away_team_id;
    matchById.set(row.id, {
      season: row.season,
      competition: row.competition,
      home_name: homeName,
      away_name: awayName,
    });
  }

  const { data: states, error: stateErr } = await supabase
    .from("match_postponement_state")
    .select("match_id, denial_count, denial_log, original_locked")
    .in("match_id", matchIds);
  if (stateErr) throw stateErr;

  const stateByMatch = new Map<
    string,
    { denial_count: number; denial_log: DenialLogEntry[]; original_locked: boolean }
  >();
  for (const s of states ?? []) {
    const row = s as {
      match_id: string;
      denial_count: number;
      denial_log: unknown;
      original_locked: boolean;
    };
    stateByMatch.set(row.match_id, {
      denial_count: row.denial_count,
      denial_log: parseDenialLog(row.denial_log),
      original_locked: row.original_locked,
    });
  }

  return rows.map((row) => {
    const match = matchById.get(row.match_id);
    const state = stateByMatch.get(row.match_id);
    return {
      ...row,
      home_name: match?.home_name ?? "Unknown",
      away_name: match?.away_name ?? "Unknown",
      season: match?.season ?? null,
      competition: match?.competition ?? null,
      denial_count: state?.denial_count ?? 0,
      denial_log: state?.denial_log ?? [],
      original_locked: state?.original_locked ?? false,
    };
  });
}
