export type MatchweekMatchFields = {
  season: number | null;
  competition: string | null;
  stage?: string | null;
  game_week_label: string | null;
  match_week: number | null;
  scheduled_at: string;
};

const PER_MATCH_KO_LABEL = /^(KO|QF|SF|F)\d+$/i;

/** Single-fixture knockout codes (KO3, QF1) — not a full-slate label like Matchday 3. */
export function isPerMatchKnockoutLabel(
  label: string | null | undefined,
): boolean {
  const t = label?.trim();
  return Boolean(t && PER_MATCH_KO_LABEL.test(t));
}

/**
 * Bucket key for “next matchweek” commands — groups an entire slate together.
 * World Cup knockout ties with per-match KO labels share one bucket per stage.
 */
export function matchweekKey(m: MatchweekMatchFields): string {
  const season = m.season ?? 0;
  const competition = m.competition ?? "";
  const stage = m.stage?.trim() || "";
  const gw = m.game_week_label?.trim();

  if (competition === "World Cup" && stage && stage !== "Group") {
    if (!gw || isPerMatchKnockoutLabel(gw)) {
      return `${season}|${competition}|${stage}`;
    }
  }

  if (gw && gw !== "—") {
    return `${season}|${competition}|${gw}`;
  }
  if (m.match_week != null) {
    return `${season}|${competition}|mw:${m.match_week}`;
  }
  const day = m.scheduled_at?.slice(0, 10) ?? "unknown";
  return `${season}|${competition}|d:${day}`;
}

export function matchweekLabel(m: MatchweekMatchFields): string {
  const gw = m.game_week_label?.trim();
  const stage = m.stage?.trim();
  if (stage && stage !== "Group" && isPerMatchKnockoutLabel(gw)) {
    return stage;
  }
  if (gw && gw !== "—") return gw;
  if (m.match_week != null) return `Matchweek ${m.match_week}`;
  return "Next matchday";
}
