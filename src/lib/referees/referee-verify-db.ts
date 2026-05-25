import { createSupabaseServerClient } from "@/lib/supabase-server";

export type RefereeStatus =
  | "pending"
  | "active"
  | "denied"
  | "suspended"
  | "removed";

export type RefereeRow = {
  id: string;
  discord_id: string;
  discord_username: string | null;
  roblox_user_id: string | null;
  roblox_username: string | null;
  status: RefereeStatus;
  tier: string | null;
  notes: string | null;
  approved_by_discord_id: string | null;
  approved_at: string | null;
  denied_by_discord_id: string | null;
  denied_at: string | null;
  created_at: string;
  updated_at: string;
};

export type UpsertRefereePendingResult =
  | { ok: true; outcome: "created" | "updated" | "already_pending" }
  | {
      ok: false;
      code: "already_active" | "suspended" | "db_error";
      error?: string;
    };

export async function findRefereeByDiscordId(
  discordId: string,
): Promise<RefereeRow | null> {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("referees")
    .select("*")
    .eq("discord_id", discordId)
    .maybeSingle();
  if (error) {
    console.error("[referee] find by discord:", error);
    return null;
  }
  return (data as RefereeRow | null) ?? null;
}

export async function upsertRefereePendingFromVerify(input: {
  discordId: string;
  discordUsername: string;
  robloxUsername: string;
  robloxUserId: string;
}): Promise<UpsertRefereePendingResult> {
  const supabase = createSupabaseServerClient();
  const now = new Date().toISOString();
  const existing = await findRefereeByDiscordId(input.discordId);

  if (existing?.status === "active") {
    return { ok: false, code: "already_active" };
  }
  if (existing?.status === "suspended") {
    return {
      ok: false,
      code: "suspended",
      error: "Your referee account is suspended. Contact staff.",
    };
  }

  const payload = {
    discord_id: input.discordId,
    discord_username: input.discordUsername,
    roblox_username: input.robloxUsername.trim(),
    roblox_user_id: input.robloxUserId.trim(),
    notes: null,
    status: "pending" as const,
    updated_at: now,
    denied_by_discord_id: null,
    denied_at: null,
  };

  if (existing?.status === "pending") {
    const { error } = await supabase
      .from("referees")
      .update(payload)
      .eq("id", existing.id);
    if (error) {
      console.error("[referee] verify pending update:", error);
      return { ok: false, code: "db_error", error: "Could not save verification." };
    }
    return { ok: true, outcome: "already_pending" };
  }

  if (existing) {
    const { error } = await supabase
      .from("referees")
      .update(payload)
      .eq("id", existing.id);
    if (error) {
      console.error("[referee] verify re-open update:", error);
      return { ok: false, code: "db_error", error: "Could not save verification." };
    }
    return { ok: true, outcome: "updated" };
  }

  const { error } = await supabase.from("referees").insert({
    ...payload,
    created_at: now,
  });
  if (error) {
    console.error("[referee] verify insert:", error);
    return { ok: false, code: "db_error", error: "Could not save verification." };
  }
  return { ok: true, outcome: "created" };
}
