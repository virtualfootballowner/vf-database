/**
 * Season 3 World Cup knockout tree — slot labels from the official bracket sheet.
 * Group nations are filled after the draw; these labels stay fixed through the tournament.
 */

export type WorldCupKnockoutMatchDef = {
  fixtureCode: string;
  matchNo: number;
  stage: "Round of 16" | "Quarter-Final" | "Semi-Final" | "Final";
  homeLabel: string;
  awayLabel: string;
  /** Winner of this fixture code feeds the home side of the target. */
  feedsHomeOf?: string;
  /** Winner feeds the away side of the target. */
  feedsAwayOf?: string;
};

export const S3_WORLD_CUP_KNOCKOUT_MATCHES: WorldCupKnockoutMatchDef[] = [
  {
    fixtureCode: "S3-WC-R16-01",
    matchNo: 37,
    stage: "Round of 16",
    homeLabel: "1A",
    awayLabel: "3C/D/E",
    feedsHomeOf: "S3-WC-QF-01",
  },
  {
    fixtureCode: "S3-WC-R16-02",
    matchNo: 38,
    stage: "Round of 16",
    homeLabel: "2A",
    awayLabel: "2C",
    feedsAwayOf: "S3-WC-QF-01",
  },
  {
    fixtureCode: "S3-WC-R16-03",
    matchNo: 39,
    stage: "Round of 16",
    homeLabel: "1B",
    awayLabel: "3A/D/E/F",
    feedsHomeOf: "S3-WC-QF-02",
  },
  {
    fixtureCode: "S3-WC-R16-04",
    matchNo: 40,
    stage: "Round of 16",
    homeLabel: "2B",
    awayLabel: "2F",
    feedsAwayOf: "S3-WC-QF-02",
  },
  {
    fixtureCode: "S3-WC-R16-05",
    matchNo: 41,
    stage: "Round of 16",
    homeLabel: "1C",
    awayLabel: "3A/B/F",
    feedsHomeOf: "S3-WC-QF-03",
  },
  {
    fixtureCode: "S3-WC-R16-06",
    matchNo: 42,
    stage: "Round of 16",
    homeLabel: "1D",
    awayLabel: "2E",
    feedsAwayOf: "S3-WC-QF-03",
  },
  {
    fixtureCode: "S3-WC-R16-07",
    matchNo: 43,
    stage: "Round of 16",
    homeLabel: "1E",
    awayLabel: "3A/B/C/D",
    feedsHomeOf: "S3-WC-QF-04",
  },
  {
    fixtureCode: "S3-WC-R16-08",
    matchNo: 44,
    stage: "Round of 16",
    homeLabel: "1F",
    awayLabel: "2D",
    feedsAwayOf: "S3-WC-QF-04",
  },
  {
    fixtureCode: "S3-WC-QF-01",
    matchNo: 45,
    stage: "Quarter-Final",
    homeLabel: "W37",
    awayLabel: "W38",
    feedsHomeOf: "S3-WC-SF-01",
  },
  {
    fixtureCode: "S3-WC-QF-02",
    matchNo: 46,
    stage: "Quarter-Final",
    homeLabel: "W39",
    awayLabel: "W40",
    feedsAwayOf: "S3-WC-SF-01",
  },
  {
    fixtureCode: "S3-WC-QF-03",
    matchNo: 47,
    stage: "Quarter-Final",
    homeLabel: "W41",
    awayLabel: "W42",
    feedsHomeOf: "S3-WC-SF-02",
  },
  {
    fixtureCode: "S3-WC-QF-04",
    matchNo: 48,
    stage: "Quarter-Final",
    homeLabel: "W43",
    awayLabel: "W44",
    feedsAwayOf: "S3-WC-SF-02",
  },
  {
    fixtureCode: "S3-WC-SF-01",
    matchNo: 49,
    stage: "Semi-Final",
    homeLabel: "W45",
    awayLabel: "W46",
    feedsHomeOf: "S3-WC-F-01",
  },
  {
    fixtureCode: "S3-WC-SF-02",
    matchNo: 50,
    stage: "Semi-Final",
    homeLabel: "W47",
    awayLabel: "W48",
    feedsAwayOf: "S3-WC-F-01",
  },
  {
    fixtureCode: "S3-WC-F-01",
    matchNo: 51,
    stage: "Final",
    homeLabel: "W49",
    awayLabel: "W50",
  },
];

const matchByCode = new Map(
  S3_WORLD_CUP_KNOCKOUT_MATCHES.map((m) => [m.fixtureCode, m]),
);

export function worldCupKnockoutMatch(
  fixtureCode: string,
): WorldCupKnockoutMatchDef | undefined {
  return matchByCode.get(fixtureCode);
}

/** Left-to-right bracket columns for the “Road to the final” UI. */
export const S3_WORLD_CUP_BRACKET_COLUMNS: {
  side: "left" | "center" | "right";
  rounds: { stage: string; fixtureCodes: string[] }[];
}[] = [
  {
    side: "left",
    rounds: [
      {
        stage: "Round of 16",
        fixtureCodes: [
          "S3-WC-R16-01",
          "S3-WC-R16-02",
          "S3-WC-R16-03",
          "S3-WC-R16-04",
        ],
      },
      {
        stage: "Quarter-Finals",
        fixtureCodes: ["S3-WC-QF-01", "S3-WC-QF-02"],
      },
      { stage: "Semi-Finals", fixtureCodes: ["S3-WC-SF-01"] },
    ],
  },
  {
    side: "center",
    rounds: [{ stage: "Final", fixtureCodes: ["S3-WC-F-01"] }],
  },
  {
    side: "right",
    rounds: [
      { stage: "Semi-Finals", fixtureCodes: ["S3-WC-SF-02"] },
      {
        stage: "Quarter-Finals",
        fixtureCodes: ["S3-WC-QF-03", "S3-WC-QF-04"],
      },
      {
        stage: "Round of 16",
        fixtureCodes: [
          "S3-WC-R16-05",
          "S3-WC-R16-06",
          "S3-WC-R16-07",
          "S3-WC-R16-08",
        ],
      },
    ],
  },
];

/** Short legend for winner placeholders (W37 = winner of M37). */
export function formatKnockoutSlotLabel(label: string): string {
  const w = /^W(\d+)$/.exec(label.trim());
  if (w) return `Winner M${w[1]}`;
  return label;
}
