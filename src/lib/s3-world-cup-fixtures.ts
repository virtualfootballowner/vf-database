/**
 * Season 3 — 24-team World Cup skeleton: 6 groups × 4 teams (round-robin 6 each),
 * then Round of 16 (8), Quarter (4), Semi (2), Final (1).
 *
 * Group stage uses empty team names; `metadata` carries seeds (A1…F4) for draws.
 * Knockout rows use bracket placeholders until results link teams.
 */

export type WorldCupStructureConfig = {
  format: "world_cup_24";
  groups: 6;
  teams_per_group: 4;
  group_stage_matches_per_group: 6;
  round_of_16_matches: 8;
  quarter_final_matches: 4;
  semi_final_matches: 2;
  final_matches: 1;
  /** Top two per group plus four best third-placed → 16 knockouts (classic 24-team format). */
  advancers_per_group: 2;
  best_third_place_advancers: 4;
};

export const S3_WORLD_CUP_STRUCTURE: WorldCupStructureConfig = {
  format: "world_cup_24",
  groups: 6,
  teams_per_group: 4,
  group_stage_matches_per_group: 6,
  round_of_16_matches: 8,
  quarter_final_matches: 4,
  semi_final_matches: 2,
  final_matches: 1,
  advancers_per_group: 2,
  best_third_place_advancers: 4,
};

/** Pair indices for a double round-style single round-robin of 4 teams (6 games). */
const FOUR_TEAM_ROUND_ROBIN: [number, number][] = [
  [0, 1],
  [2, 3],
  [0, 2],
  [1, 3],
  [0, 3],
  [1, 2],
];

export type WorldCupFixtureSeedRow = {
  season: 3;
  competition: "World Cup";
  fixture_code: string;
  stage: string;
  round_order: number;
  group_code: string | null;
  home_team_name: string;
  away_team_name: string;
  roblox_match_id: null;
  metadata: Record<string, unknown>;
};

const GROUP_LETTERS = ["A", "B", "C", "D", "E", "F"] as const;

function seedLabel(group: string, pos: 1 | 2 | 3 | 4): string {
  return `${group}${pos}`;
}

export function buildS3WorldCup24FixtureRows(): WorldCupFixtureSeedRow[] {
  const rows: WorldCupFixtureSeedRow[] = [];
  let order = 0;

  for (const g of GROUP_LETTERS) {
    FOUR_TEAM_ROUND_ROBIN.forEach(([hi, ai], idx) => {
      order += 1;
      const gn = idx + 1;
      rows.push({
        season: 3,
        competition: "World Cup",
        fixture_code: `S3-WC-G-${g}-${String(gn).padStart(2, "0")}`,
        stage: "Group",
        round_order: order,
        group_code: g,
        home_team_name: "",
        away_team_name: "",
        roblox_match_id: null,
        metadata: {
          structure: "s3_world_cup_24",
          group: g,
          home_seed: seedLabel(g, (hi + 1) as 1 | 2 | 3 | 4),
          away_seed: seedLabel(g, (ai + 1) as 1 | 2 | 3 | 4),
          match_in_group: gn,
        },
      });
    });
  }

  const koStages: { stage: string; count: number; prefix: string }[] = [
    { stage: "Round of 16", count: 8, prefix: "S3-WC-R16" },
    { stage: "Quarter-Final", count: 4, prefix: "S3-WC-QF" },
    { stage: "Semi-Final", count: 2, prefix: "S3-WC-SF" },
    { stage: "Final", count: 1, prefix: "S3-WC-F" },
  ];

  for (const { stage, count, prefix } of koStages) {
    for (let i = 1; i <= count; i += 1) {
      order += 1;
      rows.push({
        season: 3,
        competition: "World Cup",
        fixture_code: `${prefix}-${String(i).padStart(2, "0")}`,
        stage,
        round_order: order,
        group_code: null,
        home_team_name: "",
        away_team_name: "",
        roblox_match_id: null,
        metadata: {
          structure: "s3_world_cup_24",
          ko_slot: `${prefix}-${i}`,
          stage,
        },
      });
    }
  }

  return rows;
}
