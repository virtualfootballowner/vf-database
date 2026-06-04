/** Broad playing roles for marketplace + contract offers. */
export const POSITION_GROUP_CHOICES = [
  { name: "Goalkeeper", value: "Goalkeeper" },
  { name: "Defender", value: "Defender" },
  { name: "Midfielder", value: "Midfielder" },
  { name: "Attacker", value: "Attacker" },
] as const;

/** Tactical positions for squad sheet / optional detail on contracts. */
export const SPECIFIC_POSITION_CHOICES = [
  { name: "GK", value: "GK" },
  { name: "CB", value: "CB" },
  { name: "WB", value: "WB" },
  { name: "CDM", value: "CDM" },
  { name: "CM", value: "CM" },
  { name: "CAM", value: "CAM" },
  { name: "LW", value: "LW" },
  { name: "RW", value: "RW" },
  { name: "ST", value: "ST" },
] as const;

export type PositionGroup = (typeof POSITION_GROUP_CHOICES)[number]["value"];

const GROUP_SET = new Set<string>(
  POSITION_GROUP_CHOICES.map((c) => c.value),
);

/** Stored on contracts / squad sheet from /contract. */
export const CONTRACT_ROLE_CHOICES = [
  { name: "Starter", value: "Starter" },
  { name: "Rotational", value: "Rotational" },
  { name: "Bench", value: "Bench" },
  { name: "Reserve", value: "Reserve" },
] as const;

export function isPositionGroup(value: string): value is PositionGroup {
  return GROUP_SET.has(value);
}

/** Tactical code for squad buckets — handles legacy `Midfielder (CM)` labels. */
export function squadPositionCode(pos: string | null | undefined): string {
  const trimmed = pos?.trim() ?? "";
  if (!trimmed) return "";

  const paren = /\(([^)]+)\)\s*$/.exec(trimmed);
  if (paren?.[1]?.trim()) return paren[1].trim().toUpperCase();

  const upper = trimmed.toUpperCase();
  const broad: Record<string, string> = {
    GOALKEEPER: "GK",
    DEFENDER: "DEF",
    MIDFIELDER: "MID",
    ATTACKER: "FWD",
  };
  return broad[upper] ?? upper;
}

/** e.g. `Midfielder (CM)` or `Attacker` when no specific role picked. */
export function formatContractPositionLabel(
  group: string,
  specific: string | null | undefined,
): string {
  const g = group.trim();
  const s = specific?.trim();
  if (!g) return s || "—";
  if (!s || s === g) return g;
  return `${g} (${s})`;
}

/** Free-agent line: `Midfielder · CM, CAM` */
export function formatFreeAgentPositions(
  group: string,
  extraRaw: string | null | undefined,
): string {
  const parts = [group.trim()];
  const extra = parseExtraPositions(extraRaw);
  if (extra.length > 0) parts.push(extra.join(", "));
  return parts.filter(Boolean).join(" · ");
}

export function parseExtraPositions(raw: string | null | undefined): string[] {
  if (!raw?.trim()) return [];
  return [
    ...new Set(
      raw
        .split(/[,/|]+/)
        .map((s) => s.trim())
        .filter(Boolean)
        .slice(0, 6),
    ),
  ];
}

/** Prefer contract sheet position, then profile position. */
export function displaySquadPosition(
  rosterPosition: string | null | undefined,
  profilePosition: string | null | undefined,
): string {
  const roster = rosterPosition?.trim();
  if (roster) return roster;
  const profile = profilePosition?.trim();
  return profile || "Position unset";
}

export function rosterRoleLabel(role: string | null | undefined): string | null {
  const r = role?.trim();
  return r || null;
}
