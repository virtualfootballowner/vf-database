/**
 * Season 3 — 24-team World Cup: 6 groups × 4 (round-robin 6 each),
 * then Round of 16 (8) → Quarter-Finals (4) → Semi-Finals (2) → Final (1).
 *
 * Advancement: top 2 from every group (12) + best 4 third-place teams (4) → 16.
 *
 * Group slots use empty team names until the draw; `metadata` carries seeds (A1…F4).
 */

import { S3_WORLD_CUP_KNOCKOUT_MATCHES } from "@/lib/s3-world-cup-knockout-bracket";
import { S3_WORLD_CUP_GROUP_FIXTURES } from "@/lib/s3-world-cup-group-schedule";

export {
  S3_WORLD_CUP_GROUP_LETTERS,
  S3_WORLD_CUP_GROUPS,
  type S3WorldCupGroupLetter,
} from "@/lib/s3-world-cup-groups";

export type WorldCupStructureConfig = {
  format: "world_cup_24";
  groups: 6;
  teams_per_group: 4;
  group_stage_matches_per_group: 6;
  round_of_16_matches: 8;
  quarter_final_matches: 4;
  semi_final_matches: 2;
  final_matches: 1;
  /** Guaranteed advancers from each group (1st + 2nd). */
  advancers_per_group: 2;
  /** Best third-place teams that also advance. */
  best_third_place_advancers: 4;
  knockout_advancers_total: 16;
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
  knockout_advancers_total: 16,
};

export type WorldCupFixtureSeedRow = {
  season: 3;
  competition: "World Cup";
  fixture_code: string;
  stage: string;
  round_order: number;
  group_code: string | null;
  home_team_name: string;
  away_team_name: string;
  roblox_match_id: string | null;
  metadata: Record<string, unknown>;
};

export function buildS3WorldCupFixtureRows(): WorldCupFixtureSeedRow[] {
  const rows: WorldCupFixtureSeedRow[] = [];
  let order = 0;

  for (const fx of S3_WORLD_CUP_GROUP_FIXTURES) {
    order += 1;
    rows.push({
      season: 3,
      competition: "World Cup",
      fixture_code: fx.fixtureCode,
      stage: "Group",
      round_order: order,
      group_code: fx.group,
      home_team_name: fx.homeTeamName,
      away_team_name: fx.awayTeamName,
      roblox_match_id: fx.fixtureCode,
      metadata: {
        structure: "s3_world_cup_24",
        group: fx.group,
        match_in_group: fx.matchInGroup,
        game_week: fx.gameWeek,
        game_week_label: fx.gameWeekLabel,
        scheduled_at: fx.scheduledAt,
        stadium: fx.stadium,
        home_slug: fx.homeSlug,
        away_slug: fx.awaySlug,
      },
    });
  }

  for (const ko of S3_WORLD_CUP_KNOCKOUT_MATCHES) {
    order += 1;
    rows.push({
      season: 3,
      competition: "World Cup",
      fixture_code: ko.fixtureCode,
      stage: ko.stage,
      round_order: order,
      group_code: null,
      home_team_name: "",
      away_team_name: "",
      roblox_match_id: null,
      metadata: {
        structure: "s3_world_cup_24",
        ko_slot: ko.fixtureCode,
        stage: ko.stage,
        short_code: ko.shortCode,
        home_slot: ko.homeLabel,
        away_slot: ko.awayLabel,
        feeds_home_of: ko.feedsHomeOf ?? null,
        feeds_away_of: ko.feedsAwayOf ?? null,
      },
    });
  }

  return rows;
}
