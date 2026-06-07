import { S3_WORLD_CUP_KNOCKOUT_MATCHES } from "@/lib/s3-world-cup-knockout-bracket";
import {
  S3_WORLD_CUP_FINAL_CALENDAR,
  S3_WORLD_CUP_KO_DAY_SLOTS_BST,
  S3_WORLD_CUP_QF_CALENDAR,
  S3_WORLD_CUP_R16_CALENDAR,
  S3_WORLD_CUP_SF_CALENDAR,
  S3_WORLD_CUP_STADIUM_TBD,
  S3_WORLD_CUP_STAGGERED_SLOTS_BST,
  type WcKnockoutCalendarDay,
} from "@/lib/s3-world-cup-calendar";
import { bstKickoffIso } from "@/lib/wc-fixture-kickoff";

export type S3WorldCupKnockoutFixture = {
  fixtureCode: string;
  shortCode: string;
  stage: "Round of 16" | "Quarter-Final" | "Semi-Final" | "Final";
  homeLabel: string;
  awayLabel: string;
  scheduledAt: string;
  calendarDate: string;
  dayLabel: string;
  stadium: typeof S3_WORLD_CUP_STADIUM_TBD;
};

const matchByCode = new Map(
  S3_WORLD_CUP_KNOCKOUT_MATCHES.map((m) => [m.fixtureCode, m]),
);

function buildFromCalendar(
  days: readonly WcKnockoutCalendarDay[],
): S3WorldCupKnockoutFixture[] {
  const out: S3WorldCupKnockoutFixture[] = [];

  for (const day of days) {
    day.fixtureCodes.forEach((code, idx) => {
      const def = matchByCode.get(code);
      if (!def) return;
      const slots =
        day.fixtureCodes.length === 1
          ? (["20:00"] as const)
          : day.fixtureCodes.length > 2
            ? S3_WORLD_CUP_STAGGERED_SLOTS_BST
            : S3_WORLD_CUP_KO_DAY_SLOTS_BST;
      const slot = slots[idx] ?? slots[slots.length - 1]!;

      out.push({
        fixtureCode: def.fixtureCode,
        shortCode: def.shortCode,
        stage: def.stage,
        homeLabel: def.homeLabel,
        awayLabel: def.awayLabel,
        scheduledAt: bstKickoffIso(day.date, slot),
        calendarDate: day.date,
        dayLabel: day.dayLabel,
        stadium: S3_WORLD_CUP_STADIUM_TBD,
      });
    });
  }

  return out;
}

export const S3_WORLD_CUP_KNOCKOUT_FIXTURES: S3WorldCupKnockoutFixture[] = [
  ...buildFromCalendar(S3_WORLD_CUP_R16_CALENDAR),
  ...buildFromCalendar(S3_WORLD_CUP_QF_CALENDAR),
  ...buildFromCalendar(S3_WORLD_CUP_SF_CALENDAR),
  ...buildFromCalendar(S3_WORLD_CUP_FINAL_CALENDAR),
];
