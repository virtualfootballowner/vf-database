import Image from "next/image";

import type { Team } from "./teams-data";

type TeamCrestProps = {
  team: Pick<Team, "name" | "short" | "logo">;
  size?: "xs" | "sm" | "md" | "lg";
};

const SIZE_MAP = {
  xs: { box: "h-5 w-5", text: "text-[8px]", sizes: "20px" },
  sm: { box: "h-10 w-10", text: "text-[10px]", sizes: "40px" },
  md: { box: "h-14 w-14", text: "text-sm", sizes: "56px" },
  lg: { box: "h-24 w-24", text: "text-xl", sizes: "96px" },
} as const;

export function TeamCrest({ team, size = "md" }: TeamCrestProps) {
  const { box, text, sizes } = SIZE_MAP[size];
  return (
    <div
      className={`relative flex shrink-0 items-center justify-center ${box}`}
    >
      {team.logo ? (
        <Image
          src={team.logo}
          alt={`${team.name} crest`}
          fill
          sizes={sizes}
          className="object-contain"
        />
      ) : (
        <span className={`font-black tracking-wide text-white ${text}`}>
          {team.short}
        </span>
      )}
    </div>
  );
}
