import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase-server";
import type { SiteRefereeRow } from "@/lib/referees/site-referees-types";

export type { SiteRefereeRow } from "@/lib/referees/site-referees-types";

function assignmentCountsByRefereeId(
  rows: { referee_id: string | null }[],
): Map<string, number> {
  const map = new Map<string, number>();
  for (const row of rows) {
    const id = row.referee_id?.trim();
    if (!id) continue;
    map.set(id, (map.get(id) ?? 0) + 1);
  }
  return map;
}

export async function listRefereesForSite(): Promise<SiteRefereeRow[]> {
  try {
    const supabase = createSupabaseServerClient();

    const [refsResult, assignResult] = await Promise.all([
      supabase
        .from("referees")
        .select(
          "id, discord_username, roblox_user_id, roblox_username, tier, status, approved_at",
        )
        .in("status", ["active", "suspended"])
        .order("approved_at", { ascending: false, nullsFirst: false }),
      supabase
        .from("referee_assignments")
        .select("referee_id")
        .in("status", ["claimed", "completed"])
        .not("referee_id", "is", null),
    ]);

    if (refsResult.error) {
      console.error("[referees-site] list:", refsResult.error);
      return [];
    }

    const counts = assignmentCountsByRefereeId(
      (assignResult.data ?? []) as { referee_id: string | null }[],
    );

    return ((refsResult.data ?? []) as Omit<SiteRefereeRow, "assignment_count">[]).map(
      (row) => ({
        ...row,
        assignment_count: counts.get(row.id) ?? 0,
      }),
    );
  } catch (e) {
    console.error("[referees-site] fetch failed:", e);
    return [];
  }
}