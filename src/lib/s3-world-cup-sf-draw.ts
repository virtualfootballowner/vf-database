/**
 * Season 3 World Cup — Semi-final draw (post quarter-finals).
 * Kickoffs in BST from the official SF calendar.
 */

export type S3WorldCupSfDrawEntry = {
  fixtureCode: string;
  shortCode: string;
  homeSlug: string;
  awaySlug: string;
  calendarDate: string;
  dayLabel: string;
  kickoffBst: string;
};

export const S3_WORLD_CUP_SF_DRAW: readonly S3WorldCupSfDrawEntry[] = [
  {
    fixtureCode: "S3-WC-SF-01",
    shortCode: "SF1",
    homeSlug: "nigeria",
    awaySlug: "norway",
    calendarDate: "2026-07-10",
    dayLabel: "Semi-final 1",
    kickoffBst: "20:00",
  },
  {
    fixtureCode: "S3-WC-SF-02",
    shortCode: "SF2",
    homeSlug: "canada",
    awaySlug: "brazil",
    calendarDate: "2026-07-11",
    dayLabel: "Semi-final 2",
    kickoffBst: "20:00",
  },
];

export const S3_WORLD_CUP_SF_DRAW_BY_CODE = new Map(
  S3_WORLD_CUP_SF_DRAW.map((e) => [e.fixtureCode, e]),
);
