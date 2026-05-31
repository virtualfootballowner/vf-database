import {
  formatKnockoutSlotLabel,
  S3_WORLD_CUP_BRACKET_COLUMNS,
  worldCupKnockoutMatch,
} from "@/lib/s3-world-cup-knockout-bracket";

function BracketMatchTile({
  fixtureCode,
  isFinal,
}: {
  fixtureCode: string;
  isFinal?: boolean;
}) {
  const m = worldCupKnockoutMatch(fixtureCode);
  if (!m) return null;

  const tileClass = isFinal
    ? "rounded-lg border border-amber-300/45 bg-gradient-to-b from-amber-300/15 via-amber-300/[0.07] to-black/30 px-2.5 py-2 ring-1 ring-amber-200/20"
    : "rounded-lg border border-white/10 bg-black/25 px-2.5 py-2";

  const labelClass = isFinal
    ? "font-bold text-amber-100"
    : "font-medium text-white/90";

  return (
    <div className={tileClass}>
      <p className="mb-1.5 text-[9px] font-semibold uppercase tracking-[0.16em] text-white/40">
        M{m.matchNo}
      </p>
      <div className="flex flex-col gap-1 border-b border-white/5 pb-1">
        <span className={`truncate text-[11px] leading-tight ${labelClass}`}>
          {formatKnockoutSlotLabel(m.homeLabel)}
        </span>
      </div>
      <div className="pt-1">
        <span
          className={`truncate text-[11px] leading-tight ${
            isFinal ? "font-bold text-amber-100/90" : "font-medium text-white/75"
          }`}
        >
          {formatKnockoutSlotLabel(m.awayLabel)}
        </span>
      </div>
      {isFinal ? (
        <p className="mt-1.5 border-t border-amber-300/20 pt-1 text-[9px] font-bold uppercase tracking-[0.14em] text-amber-200/90">
          Final
        </p>
      ) : null}
    </div>
  );
}

export function WorldCupKnockoutBracket() {
  return (
    <div className="-mx-1 overflow-x-auto pb-2">
      <div className="flex min-h-[420px] w-max origin-top gap-3 px-1 sm:gap-4">
        {S3_WORLD_CUP_BRACKET_COLUMNS.map((col) => (
          <div
            key={col.side}
            className={`flex shrink-0 flex-col gap-4 ${
              col.side === "center" ? "justify-center" : "justify-between py-6"
            }`}
          >
            {col.rounds.map((round) => (
              <div
                key={`${col.side}-${round.stage}`}
                className={`flex flex-col gap-2 ${
                  col.side === "center" ? "w-[168px]" : "w-[152px] sm:w-[168px]"
                }`}
              >
                <p
                  className={`text-[9px] font-semibold uppercase tracking-[0.18em] ${
                    round.stage === "Final"
                      ? "text-amber-200/85"
                      : "text-white/50"
                  }`}
                >
                  {round.stage}
                </p>
                <div
                  className={`flex flex-col gap-2 ${
                    round.fixtureCodes.length > 2 ? "gap-2.5" : "gap-3"
                  }`}
                >
                  {round.fixtureCodes.map((code) => (
                    <BracketMatchTile
                      key={code}
                      fixtureCode={code}
                      isFinal={round.stage === "Final"}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
