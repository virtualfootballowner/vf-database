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
        M{m.matchNo}
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

export function WorldCupKnockoutBracket() {
  return (
    <div className="w-full">
      <div className="overflow-x-auto pb-1">
        <div className="mx-auto flex w-full min-w-[680px] gap-1.5 sm:gap-2 md:gap-3 lg:gap-4">
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
        </div>
      </div>
      <p className="mt-3 text-center text-[10px] text-white/35 sm:text-xs">
        Scroll horizontally on small screens · slot labels update after the draw
      </p>
    </div>
  );
}
