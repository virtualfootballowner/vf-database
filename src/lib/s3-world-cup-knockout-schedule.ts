import { teams } from "@/app/teams/teams-data";
import { S3_WORLD_CUP_KNOCKOUT_MATCHES } from "@/lib/s3-world-cup-knockout-bracket";
import {
  S3_WORLD_CUP_FINAL_CALENDAR,
  S3_WORLD_CUP_KO_DAY_SLOTS_BST,
  S3_WORLD_CUP_R16_CALENDAR,
  S3_WORLD_CUP_SF_CALENDAR,
  S3_WORLD_CUP_STADIUM_TBD,
  S3_WORLD_CUP_STAGGERED_SLOTS_BST,
  type WcKnockoutCalendarDay,
} from "@/lib/s3-world-cup-calendar";
import { S3_WORLD_CUP_QF_DRAW } from "@/lib/s3-world-cup-qf-draw";
import { S3_WORLD_CUP_R16_DRAW_BY_CODE } from "@/lib/s3-world-cup-r16-draw";
import { S3_WORLD_CUP_SF_DRAW } from "@/lib/s3-world-cup-sf-draw";
import { bstKickoffIso } from "@/lib/wc-fixture-kickoff";

export type S3WorldCupKnockoutFixture = {
  fixtureCode: string;
  shortCode: string;
  stage: "Round of 16" | "Quarter-Final" | "Semi-Final" | "Final";
  homeLabel: string;
  awayLabel: string;
  homeSlug?: string;
  awaySlug?: string;
  homeTeamName?: string;
  awayTeamName?: string;
  matchNumber?: number;
  scheduledAt: string;
  calendarDate: string;
  dayLabel: string;
  stadium: typeof S3_WORLD_CUP_STADIUM_TBD;
};

const matchByCode = new Map(
  S3_WORLD_CUP_KNOCKOUT_MATCHES.map((m) => [m.fixtureCode, m]),
);

const teamNameBySlug = new Map(teams.map((t) => [t.slug, t.name]));

function buildR16Fixtures(): S3WorldCupKnockoutFixture[] {
  const out: S3WorldCupKnockoutFixture[] = [];

  for (const day of S3_WORLD_CUP_R16_CALENDAR) {
    for (const code of day.fixtureCodes) {
      const def = matchByCode.get(code);
      const draw = S3_WORLD_CUP_R16_DRAW_BY_CODE.get(code);
      if (!def || !draw) continue;

      const homeTeamName = teamNameBySlug.get(draw.homeSlug) ?? draw.homeSlug;
      const awayTeamName = teamNameBySlug.get(draw.awaySlug) ?? draw.awaySlug;

      out.push({
        fixtureCode: def.fixtureCode,
        shortCode: def.shortCode,
        stage: def.stage,
        homeLabel: homeTeamName,
        awayLabel: awayTeamName,
        homeSlug: draw.homeSlug,
        awaySlug: draw.awaySlug,
        homeTeamName,
        awayTeamName,
        matchNumber: draw.matchNumber,
        scheduledAt: bstKickoffIso(day.date, draw.kickoffBst),
        calendarDate: day.date,
        dayLabel: day.dayLabel,
        stadium: S3_WORLD_CUP_STADIUM_TBD,
      });
    }
  }

  return out;
}

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
        homeSlug: def.homeSlug,
        awaySlug: def.awaySlug,
        homeTeamName: def.homeSlug
          ? teamNameBySlug.get(def.homeSlug)
          : undefined,
        awayTeamName: def.awaySlug
          ? teamNameBySlug.get(def.awaySlug)
          : undefined,
        scheduledAt: bstKickoffIso(day.date, slot),
        calendarDate: day.date,
        dayLabel: day.dayLabel,
        stadium: S3_WORLD_CUP_STADIUM_TBD,
      });
    });
  }

  return out;
}

function buildQfFixtures(): S3WorldCupKnockoutFixture[] {
  const out: S3WorldCupKnockoutFixture[] = [];

  for (const draw of S3_WORLD_CUP_QF_DRAW) {
    const def = matchByCode.get(draw.fixtureCode);
    if (!def) continue;

    const homeTeamName = teamNameBySlug.get(draw.homeSlug) ?? draw.homeSlug;
    const awayTeamName = teamNameBySlug.get(draw.awaySlug) ?? draw.awaySlug;

    out.push({
      fixtureCode: def.fixtureCode,
      shortCode: def.shortCode,
      stage: def.stage,
      homeLabel: homeTeamName,
      awayLabel: awayTeamName,
      homeSlug: draw.homeSlug,
      awaySlug: draw.awaySlug,
      homeTeamName,
      awayTeamName,
      scheduledAt: bstKickoffIso(draw.calendarDate, draw.kickoffBst),
      calendarDate: draw.calendarDate,
      dayLabel: draw.dayLabel,
      stadium: S3_WORLD_CUP_STADIUM_TBD,
    });
  }

  return out;
}

function buildSfFixtures(): S3WorldCupKnockoutFixture[] {
  const drawnCodes = new Set(S3_WORLD_CUP_SF_DRAW.map((d) => d.fixtureCode));
  const out: S3WorldCupKnockoutFixture[] = [];

  for (const day of S3_WORLD_CUP_SF_CALENDAR) {
    const remaining = day.fixtureCodes.filter((code) => !drawnCodes.has(code));
    if (remaining.length === 0) continue;
    out.push(
      ...buildFromCalendar([{ ...day, fixtureCodes: remaining }]),
    );
  }

  for (const draw of S3_WORLD_CUP_SF_DRAW) {
    const def = matchByCode.get(draw.fixtureCode);
    if (!def) continue;

    const homeTeamName = teamNameBySlug.get(draw.homeSlug) ?? draw.homeSlug;
    const awayTeamName = teamNameBySlug.get(draw.awaySlug) ?? draw.awaySlug;

    out.push({
      fixtureCode: def.fixtureCode,
      shortCode: def.shortCode,
      stage: def.stage,
      homeLabel: homeTeamName,
      awayLabel: awayTeamName,
      homeSlug: draw.homeSlug,
      awaySlug: draw.awaySlug,
      homeTeamName,
      awayTeamName,
      scheduledAt: bstKickoffIso(draw.calendarDate, draw.kickoffBst),
      calendarDate: draw.calendarDate,
      dayLabel: draw.dayLabel,
      stadium: S3_WORLD_CUP_STADIUM_TBD,
    });
  }

  return out;
}

export const S3_WORLD_CUP_KNOCKOUT_FIXTURES: S3WorldCupKnockoutFixture[] = [
  ...buildR16Fixtures(),
  ...buildQfFixtures(),
  ...buildSfFixtures(),
  ...buildFromCalendar(S3_WORLD_CUP_FINAL_CALENDAR),
];
