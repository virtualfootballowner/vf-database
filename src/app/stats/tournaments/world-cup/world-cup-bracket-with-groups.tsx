"use client";

import { TeamCrest } from "@/app/teams/team-crest";
import type { Team } from "@/app/teams/teams-data";
import { WorldCupGroupDialog } from "@/app/stats/tournaments/world-cup/world-cup-group-dialog";
import {
  S3_WORLD_CUP_GROUPS,
  type S3WorldCupGroupLetter,
} from "@/lib/s3-world-cup-groups";
import type { WorldCupGroupBundle } from "@/lib/s3-world-cup-group-standings";
import {
  formatKnockoutSlotLabel,
  worldCupKnockoutMatch,
} from "@/lib/s3-world-cup-knockout-bracket";

type ColumnLayout = "spread-4" | "pair-2" | "center-1";

const BRACKET_COLUMNS: {
  stage: string;
  fixtureCodes: string[];
  layout: ColumnLayout;
  isFinal?: boolean;
}[] = [
  {
    stage: "Round of 16",
    layout: "spread-4",
    fixtureCodes: [
      "S3-WC-R16-01",
      "S3-WC-R16-02",
      "S3-WC-R16-03",
      "S3-WC-R16-04",
    ],
  },
  {
    stage: "Quarter-Finals",
    layout: "pair-2",
    fixtureCodes: ["S3-WC-QF-01", "S3-WC-QF-02"],
  },
  {
    stage: "Semi-Finals",
    layout: "center-1",
    fixtureCodes: ["S3-WC-SF-01"],
  },
  {
    stage: "Final",
    layout: "center-1",
    fixtureCodes: ["S3-WC-F-01"],
    isFinal: true,
  },
  {
    stage: "Semi-Finals",
    layout: "center-1",
    fixtureCodes: ["S3-WC-SF-02"],
  },
  {
    stage: "Quarter-Finals",
    layout: "pair-2",
    fixtureCodes: ["S3-WC-QF-03", "S3-WC-QF-04"],
  },
  {
    stage: "Round of 16",
    layout: "spread-4",
    fixtureCodes: [
      "S3-WC-R16-05",
      "S3-WC-R16-06",
      "S3-WC-R16-07",
      "S3-WC-R16-08",
    ],
  },
];

const LAYOUT_CLASS: Record<ColumnLayout, string> = {
  "spread-4": "justify-between py-1",
  "pair-2": "justify-around py-[14%]",
  "center-1": "justify-center",
};

function GroupBracketColumn({
  letters,
  teamsBySlug,
  groupBundles,
  side,
}: {
  letters: S3WorldCupGroupLetter[];
  teamsBySlug: Record<string, Team>;
  groupBundles: Record<S3WorldCupGroupLetter, WorldCupGroupBundle>;
  side: "left" | "right";
}) {
  return (
    <div
      className={`relative flex min-w-[108px] shrink-0 flex-col sm:min-w-[124px] md:min-w-[136px] ${
        side === "left" ? "pr-1 md:pr-2" : "pl-1 md:pl-2"
      }`}
    >
      <p className="mb-2 shrink-0 text-center text-[9px] font-semibold uppercase tracking-[0.16em] text-white/45 sm:text-[10px]">
        Groups
      </p>
      <div className="flex min-h-[380px] flex-1 flex-col justify-between py-1 sm:min-h-[440px]">
        {letters.map((letter) => {
          const bundle = groupBundles[letter];
          const slugs = S3_WORLD_CUP_GROUPS[letter];
          const standingsBySlug = new Map(
            bundle.standings.map((row, idx) => [row.slug, { row, rank: idx + 1 }]),
          );

          return (
            <WorldCupGroupDialog
              key={letter}
              bundle={bundle}
              teamsBySlug={teamsBySlug}
            >
              <div className="w-full rounded-lg border border-white/12 bg-white/[0.04] px-2 py-2 backdrop-blur-sm transition hover:border-white/25 hover:bg-white/[0.07]">
                <div className="mb-1.5 flex items-center justify-between gap-1 border-b border-white/8 pb-1">
                  <div className="flex items-center gap-1.5">
                    <span className="font-display flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/5 text-[11px] font-semibold text-white">
                      {letter}
                    </span>
                    <span className="text-[9px] font-semibold uppercase tracking-[0.14em] text-white/45">
                      Group {letter}
                    </span>
                  </div>
                  <span className="text-[8px] font-semibold uppercase tracking-[0.12em] text-white/30">
                    Details
                  </span>
                </div>
                <div className="flex flex-col gap-0.5">
                  {slugs.map((slug) => {
                    const team = teamsBySlug[slug];
                    if (!team) return null;
                    const standing = standingsBySlug.get(slug);
                    const rank = standing?.rank ?? 0;
                    const pts = standing?.row.points ?? 0;
                    const played = standing?.row.played ?? 0;

                    return (
                      <div
                        key={slug}
                        className="flex items-center gap-1.5 rounded-md px-0.5 py-0.5"
                      >
                        <span className="w-3 shrink-0 text-center text-[9px] font-semibold tabular-nums text-white/35">
                          {rank || "–"}
                        </span>
                        <TeamCrest team={team} size="xs" />
                        <span className="min-w-0 flex-1 truncate text-[10px] font-medium leading-tight text-white/85 sm:text-[11px]">
                          {team.short ?? team.name}
                        </span>
                        <span
                          className="shrink-0 text-[9px] font-semibold tabular-nums text-white/45"
                          title={`${played} played`}
                        >
                          {pts}pt
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </WorldCupGroupDialog>
          );
        })}
      </div>
    </div>
  );
}

function BracketMatchTile({
  fixtureCode,
  isFinal,
}: {
  fixtureCode: string;
  isFinal?: boolean;
}) {
  const m = worldCupKnockoutMatch(fixtureCode);
  if (!m) return null;

  return (
    <div
      className={
        isFinal
          ? "w-full rounded-xl border border-amber-300/50 bg-gradient-to-b from-amber-300/20 via-amber-300/[0.08] to-black/40 px-3 py-3 shadow-[0_0_24px_rgba(251,191,36,0.12)] ring-1 ring-amber-200/25"
          : "w-full rounded-lg border border-white/12 bg-white/[0.04] px-2.5 py-2 backdrop-blur-sm transition hover:border-white/20 hover:bg-white/[0.06]"
      }
    >
      <p
        className={`mb-1.5 text-[9px] font-semibold uppercase tracking-[0.16em] ${
          isFinal ? "text-amber-200/70" : "text-white/40"
        }`}
      >
        {m.shortCode}
      </p>
      <div className="border-b border-white/8 pb-1">
        <span
          className={`block truncate text-[11px] leading-snug sm:text-xs ${
            isFinal ? "font-bold text-amber-50" : "font-medium text-white/90"
          }`}
        >
          {formatKnockoutSlotLabel(m.homeLabel)}
        </span>
      </div>
      <div className="pt-1">
        <span
          className={`block truncate text-[11px] leading-snug sm:text-xs ${
            isFinal
              ? "font-bold text-amber-100/90"
              : "font-medium text-white/70"
          }`}
        >
          {formatKnockoutSlotLabel(m.awayLabel)}
        </span>
      </div>
      {isFinal ? (
        <p className="mt-2 border-t border-amber-300/25 pt-1.5 text-center text-[9px] font-bold uppercase tracking-[0.2em] text-amber-200">
          Final
        </p>
      ) : null}
    </div>
  );
}

function BracketColumn({
  stage,
  fixtureCodes,
  layout,
  isFinal,
  showConnector,
}: {
  stage: string;
  fixtureCodes: string[];
  layout: ColumnLayout;
  isFinal?: boolean;
  showConnector?: "left" | "right";
}) {
  return (
    <div className="relative flex min-w-0 flex-1 flex-col">
      {showConnector === "left" ? (
        <span
          aria-hidden
          className="pointer-events-none absolute left-0 top-[12%] hidden h-[76%] w-px bg-gradient-to-b from-transparent via-white/15 to-transparent lg:block"
        />
      ) : null}
      {showConnector === "right" ? (
        <span
          aria-hidden
          className="pointer-events-none absolute right-0 top-[12%] hidden h-[76%] w-px bg-gradient-to-b from-transparent via-white/15 to-transparent lg:block"
        />
      ) : null}

      <p
        className={`mb-2 shrink-0 text-center text-[9px] font-semibold uppercase tracking-[0.16em] sm:text-[10px] ${
          isFinal ? "text-amber-200/90" : "text-white/45"
        }`}
      >
        {stage}
      </p>

      <div
        className={`flex min-h-[380px] flex-1 flex-col sm:min-h-[440px] ${LAYOUT_CLASS[layout]}`}
      >
        {fixtureCodes.map((code) => (
          <BracketMatchTile key={code} fixtureCode={code} isFinal={isFinal} />
        ))}
      </div>
    </div>
  );
}

export function WorldCupBracketWithGroups({
  teamsBySlug,
  groupBundles,
}: {
  teamsBySlug: Record<string, Team>;
  groupBundles: Record<S3WorldCupGroupLetter, WorldCupGroupBundle>;
}) {
  return (
    <div className="w-full">
      <p className="mb-3 text-center font-display text-sm font-semibold uppercase tracking-[0.12em] text-white/90 sm:text-base">
        24-Team Knockout · ABF / EDC Bracket Map
      </p>
      <div className="overflow-x-auto pb-1">
        <div className="mx-auto flex w-full min-w-[860px] gap-1.5 sm:gap-2 md:gap-3 lg:gap-4">
          <GroupBracketColumn
            letters={["A", "B", "C"]}
            teamsBySlug={teamsBySlug}
            groupBundles={groupBundles}
            side="left"
          />
          {BRACKET_COLUMNS.map((col, idx) => (
            <BracketColumn
              key={`${col.stage}-${idx}`}
              stage={col.stage}
              fixtureCodes={col.fixtureCodes}
              layout={col.layout}
              isFinal={col.isFinal}
              showConnector={
                idx === 2 ? "left" : idx === 4 ? "right" : undefined
              }
            />
          ))}
          <GroupBracketColumn
            letters={["D", "E", "F"]}
            teamsBySlug={teamsBySlug}
            groupBundles={groupBundles}
            side="right"
          />
        </div>
      </div>
      <p className="mt-3 text-center text-[10px] text-white/35 sm:text-xs">
        Tap a group for the full table and results · scroll horizontally on
        small screens
      </p>
    </div>
  );
}
