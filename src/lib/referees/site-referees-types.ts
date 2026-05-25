export type SiteRefereeRow = {
  id: string;
  discord_username: string | null;
  roblox_user_id: string | null;
  roblox_username: string | null;
  tier: string | null;
  status: "pending" | "active" | "denied" | "suspended" | "removed";
  approved_at: string | null;
  assignment_count: number;
};

export function refereeSiteDisplayName(row: SiteRefereeRow): string {
  const rbx = row.roblox_username?.trim();
  if (rbx) return rbx;
  const disc = row.discord_username?.trim();
  if (disc) return disc;
  return "Referee";
}