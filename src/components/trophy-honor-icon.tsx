import Image from "next/image";
import { Trophy } from "lucide-react";

import {
  accoladeImageForTitle,
  trophyImageForHonorKind,
  trophyImageForTrophyTitle,
} from "@/lib/trophy-assets";
import { cn } from "@/lib/utils";

type Props = {
  className?: string;
  iconClassName?: string;
  /** Player trophy row */
  trophyTitle?: string;
  /** Personal accolade row */
  accoladeTitle?: string;
  /** Team honor row (`team_season_honors.honor_kind`) */
  honorKind?: string;
};

export function TrophyHonorIcon({
  className,
  iconClassName,
  trophyTitle,
  accoladeTitle,
  honorKind,
}: Props) {
  const src =
    honorKind != null && honorKind !== ""
      ? trophyImageForHonorKind(honorKind)
      : trophyTitle != null && trophyTitle !== ""
        ? trophyImageForTrophyTitle(trophyTitle)
        : accoladeTitle != null && accoladeTitle !== ""
          ? accoladeImageForTitle(accoladeTitle)
          : null;

  if (src) {
    return (
      <span
        className={cn(
          "relative flex size-8 shrink-0 items-center justify-center",
          className,
        )}
      >
        <Image
          src={src}
          alt=""
          width={32}
          height={32}
          className="size-8 object-contain drop-shadow-sm"
        />
      </span>
    );
  }

  return (
    <span
      className={cn(
        "flex size-8 shrink-0 items-center justify-center rounded-md bg-white/5",
        className,
      )}
    >
      <Trophy className={cn("size-3.5 text-amber-300", iconClassName)} />
    </span>
  );
}
