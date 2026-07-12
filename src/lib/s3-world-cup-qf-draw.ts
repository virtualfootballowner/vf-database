/**
 * Season 3 World Cup — Quarter-final draw (post Round of 16).
 * Kickoffs in BST.
 */

export type S3WorldCupQfDrawEntry = {
  fixtureCode: string;
  shortCode: string;
  homeSlug: string;
  awaySlug: string;
  calendarDate: string;
  dayLabel: string;
  kickoffBst: string;
};

export const S3_WORLD_CUP_QF_DRAW: readonly S3WorldCupQfDrawEntry[] = [
  {
    fixtureCode: "S3-WC-QF-02",
    shortCode: "QF2",
    homeSlug: "norway",
    awaySlug: "belgium",
    calendarDate: "2026-07-08",
    dayLabel: "QF · Wednesday",
    kickoffBst: "20:00",
  },
  {
    fixtureCode: "S3-WC-QF-01",
    shortCode: "QF1",
    homeSlug: "nigeria",
    awaySlug: "spain",
    calendarDate: "2026-07-09",
    dayLabel: "QF · Thursday",
    kickoffBst: "21:00",
  },
  {
    fixtureCode: "S3-WC-QF-04",
    shortCode: "QF4",
    homeSlug: "canada",
    awaySlug: "portugal",
    calendarDate: "2026-07-01",
    dayLabel: "QF · Wednesday",
    kickoffBst: "21:00",
  },
  {
    fixtureCode: "S3-WC-QF-03",
    shortCode: "QF3",
    homeSlug: "somalia",
    awaySlug: "brazil",
    calendarDate: "2026-07-05",
    dayLabel: "QF · Sunday",
    kickoffBst: "18:00",
  },
];

export const S3_WORLD_CUP_QF_DRAW_BY_CODE = new Map(
  S3_WORLD_CUP_QF_DRAW.map((e) => [e.fixtureCode, e]),
);
