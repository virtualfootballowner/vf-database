/**
 * Season 3 World Cup knockout tree — slot labels from the official bracket sheet.
 * R16 ties show resolved nations once the knockout draw is set.
 */

import { teams } from "@/app/teams/teams-data";
import { S3_WORLD_CUP_QF_DRAW_BY_CODE } from "@/lib/s3-world-cup-qf-draw";
import { S3_WORLD_CUP_R16_DRAW_BY_CODE } from "@/lib/s3-world-cup-r16-draw";
import { S3_WORLD_CUP_SF_DRAW_BY_CODE } from "@/lib/s3-world-cup-sf-draw";

export type WorldCupKnockoutMatchDef = {
  fixtureCode: string;
  /** Simple display id (KO1, QF1, SF1, F1). */
  shortCode: string;
  stage: "Round of 16" | "Quarter-Final" | "Semi-Final" | "Final";
  homeLabel: string;
  awayLabel: string;
  homeSlug?: string;
  awaySlug?: string;
  feedsHomeOf?: string;
  feedsAwayOf?: string;
};

const teamNameBySlug = new Map(teams.map((t) => [t.slug, t.name]));

function applyKnockoutDraw(def: WorldCupKnockoutMatchDef): WorldCupKnockoutMatchDef {
  const r16 = S3_WORLD_CUP_R16_DRAW_BY_CODE.get(def.fixtureCode);
  if (r16) {
    return {
      ...def,
      homeLabel: teamNameBySlug.get(r16.homeSlug) ?? r16.homeSlug,
      awayLabel: teamNameBySlug.get(r16.awaySlug) ?? r16.awaySlug,
      homeSlug: r16.homeSlug,
      awaySlug: r16.awaySlug,
    };
  }

  const qf = S3_WORLD_CUP_QF_DRAW_BY_CODE.get(def.fixtureCode);
  if (qf) {
    return {
      ...def,
      homeLabel: teamNameBySlug.get(qf.homeSlug) ?? qf.homeSlug,
      awayLabel: teamNameBySlug.get(qf.awaySlug) ?? qf.awaySlug,
      homeSlug: qf.homeSlug,
      awaySlug: qf.awaySlug,
    };
  }

  const sf = S3_WORLD_CUP_SF_DRAW_BY_CODE.get(def.fixtureCode);
  if (sf) {
    return {
      ...def,
      homeLabel: teamNameBySlug.get(sf.homeSlug) ?? sf.homeSlug,
      awayLabel: teamNameBySlug.get(sf.awaySlug) ?? sf.awaySlug,
      homeSlug: sf.homeSlug,
      awaySlug: sf.awaySlug,
    };
  }

  return def;
}

const S3_WORLD_CUP_KNOCKOUT_MATCHES_RAW: WorldCupKnockoutMatchDef[] = [
  {
    fixtureCode: "S3-WC-R16-01",
    shortCode: "KO1",
    stage: "Round of 16",
    homeLabel: "1B",
    awayLabel: "3A/D/E/F",
    feedsHomeOf: "S3-WC-QF-01",
  },
  {
    fixtureCode: "S3-WC-R16-02",
    shortCode: "KO2",
    stage: "Round of 16",
    homeLabel: "1A",
    awayLabel: "2C",
    feedsAwayOf: "S3-WC-QF-01",
  },
  {
    fixtureCode: "S3-WC-R16-03",
    shortCode: "KO3",
    stage: "Round of 16",
    homeLabel: "1F",
    awayLabel: "3A/B/C",
    feedsHomeOf: "S3-WC-QF-02",
  },
  {
    fixtureCode: "S3-WC-R16-04",
    shortCode: "KO4",
    stage: "Round of 16",
    homeLabel: "2D",
    awayLabel: "2E",
    feedsAwayOf: "S3-WC-QF-02",
  },
  {
    fixtureCode: "S3-WC-R16-05",
    shortCode: "KO5",
    stage: "Round of 16",
    homeLabel: "1E",
    awayLabel: "3A/B/C/D",
    feedsHomeOf: "S3-WC-QF-03",
  },
  {
    fixtureCode: "S3-WC-R16-06",
    shortCode: "KO6",
    stage: "Round of 16",
    homeLabel: "1D",
    awayLabel: "2F",
    feedsAwayOf: "S3-WC-QF-03",
  },
  {
    fixtureCode: "S3-WC-R16-07",
    shortCode: "KO7",
    stage: "Round of 16",
    homeLabel: "1C",
    awayLabel: "3D/E/F",
    feedsHomeOf: "S3-WC-QF-04",
  },
  {
    fixtureCode: "S3-WC-R16-08",
    shortCode: "KO8",
    stage: "Round of 16",
    homeLabel: "2A",
    awayLabel: "2B",
    feedsAwayOf: "S3-WC-QF-04",
  },
  {
    fixtureCode: "S3-WC-QF-01",
    shortCode: "QF1",
    stage: "Quarter-Final",
    homeLabel: "KO1",
    awayLabel: "KO2",
    feedsHomeOf: "S3-WC-SF-01",
  },
  {
    fixtureCode: "S3-WC-QF-02",
    shortCode: "QF2",
    stage: "Quarter-Final",
    homeLabel: "KO3",
    awayLabel: "KO4",
    feedsAwayOf: "S3-WC-SF-01",
  },
  {
    fixtureCode: "S3-WC-QF-03",
    shortCode: "QF3",
    stage: "Quarter-Final",
    homeLabel: "KO5",
    awayLabel: "KO6",
    feedsHomeOf: "S3-WC-SF-02",
  },
  {
    fixtureCode: "S3-WC-QF-04",
    shortCode: "QF4",
    stage: "Quarter-Final",
    homeLabel: "KO7",
    awayLabel: "KO8",
    feedsAwayOf: "S3-WC-SF-02",
  },
  {
    fixtureCode: "S3-WC-SF-01",
    shortCode: "SF1",
    stage: "Semi-Final",
    homeLabel: "QF1",
    awayLabel: "QF2",
    feedsHomeOf: "S3-WC-F-01",
  },
  {
    fixtureCode: "S3-WC-SF-02",
    shortCode: "SF2",
    stage: "Semi-Final",
    homeLabel: "QF3",
    awayLabel: "QF4",
    feedsAwayOf: "S3-WC-F-01",
  },
  {
    fixtureCode: "S3-WC-F-01",
    shortCode: "F1",
    stage: "Final",
    homeLabel: "SF1",
    awayLabel: "SF2",
  },
];

export const S3_WORLD_CUP_KNOCKOUT_MATCHES: WorldCupKnockoutMatchDef[] =
  S3_WORLD_CUP_KNOCKOUT_MATCHES_RAW.map(applyKnockoutDraw);

const matchByCode = new Map(
  S3_WORLD_CUP_KNOCKOUT_MATCHES.map((m) => [m.fixtureCode, m]),
);

const shortCodeByRef = new Map(
  S3_WORLD_CUP_KNOCKOUT_MATCHES.map((m) => [m.shortCode, m]),
);

export function worldCupKnockoutMatch(
  fixtureCode: string,
): WorldCupKnockoutMatchDef | undefined {
  return matchByCode.get(fixtureCode);
}

/** Labels in later rounds reference earlier short codes (KO1, QF1, …). */
export function formatKnockoutSlotLabel(label: string): string {
  const t = label.trim();
  if (shortCodeByRef.has(t)) return t;
  return t;
}
