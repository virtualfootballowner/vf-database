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
  created_at: string;
};

export type PostponementStateRow = {
  match_id: string;
  denial_count: number;
  denial_log: DenialLogEntry[];
  original_locked: boolean;
};

const ACTIVE_STATUSES = ["pending_opponent", "escalated"] as const;

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

export async function fetchManagerDiscordId(
  supabase: SupabaseClient,
  teamSlug: string,
  season: number,
): Promise<string | null> {
  const { data, error } = await supabase
    .from("team_season_managers")
    .select("manager_discord_id")
    .eq("team_slug", teamSlug)
    .eq("season", season)
    .maybeSingle();
  if (error) {
    const code = (error as { code?: string }).code;
    if (code === "42703" || code === "PGRST204") return null;
    throw error;
  }
  const id = (data as { manager_discord_id?: string | null } | null)
    ?.manager_discord_id;
  return id?.trim() || null;
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

export async function fetchActiveRequestForMatch(
  supabase: SupabaseClient,
  matchId: string,
): Promise<PostponementRequestRow | null> {
  const { data, error } = await supabase
    .from("match_postponement_requests")
    .select("*")
    .eq("match_id", matchId)
    .in("status", [...ACTIVE_STATUSES])
    .maybeSingle();
  if (error) throw error;
  return data ? mapRequestRow(data) : null;
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
