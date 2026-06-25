/**
 * Season 3 World Cup — Round of 16 draw (post group stage).
 * Kickoffs are BST on the official R16 weekend (26–28 June 2026).
 */

export type S3WorldCupR16DrawEntry = {
  fixtureCode: string;
  shortCode: string;
  matchNumber: number;
  homeSlug: string;
  awaySlug: string;
  kickoffBst: string;
};

export const S3_WORLD_CUP_R16_DRAW: readonly S3WorldCupR16DrawEntry[] = [
  {
    fixtureCode: "S3-WC-R16-01",
    shortCode: "KO1",
    matchNumber: 37,
    homeSlug: "spain",
    awaySlug: "switzerland",
    kickoffBst: "13:00",
  },
  {
    fixtureCode: "S3-WC-R16-02",
    shortCode: "KO2",
    matchNumber: 38,
    homeSlug: "nigeria",
    awaySlug: "france",
    kickoffBst: "15:00",
  },
  {
    fixtureCode: "S3-WC-R16-03",
    shortCode: "KO3",
    matchNumber: 39,
    homeSlug: "norway",
    awaySlug: "mexico",
    kickoffBst: "13:00",
  },
  {
    fixtureCode: "S3-WC-R16-04",
    shortCode: "KO4",
    matchNumber: 40,
    homeSlug: "belgium",
    awaySlug: "morocco",
    kickoffBst: "14:30",
  },
  {
    fixtureCode: "S3-WC-R16-05",
    shortCode: "KO5",
    matchNumber: 41,
    homeSlug: "germany",
    awaySlug: "somalia",
    kickoffBst: "15:30",
  },
  {
    fixtureCode: "S3-WC-R16-06",
    shortCode: "KO6",
    matchNumber: 42,
    homeSlug: "brazil",
    awaySlug: "russia",
    kickoffBst: "13:00",
  },
  {
    fixtureCode: "S3-WC-R16-07",
    shortCode: "KO7",
    matchNumber: 43,
    homeSlug: "canada",
    awaySlug: "argentina",
    kickoffBst: "14:30",
  },
  {
    fixtureCode: "S3-WC-R16-08",
    shortCode: "KO8",
    matchNumber: 44,
    homeSlug: "portugal",
    awaySlug: "albania",
    kickoffBst: "15:30",
  },
];

export const S3_WORLD_CUP_R16_DRAW_BY_CODE = new Map(
  S3_WORLD_CUP_R16_DRAW.map((e) => [e.fixtureCode, e]),
);
