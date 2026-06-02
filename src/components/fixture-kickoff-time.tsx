"use client";

import { useEffect, useState } from "react";

import {
  formatDualTimezoneKickoffTime,
  formatLocalKickoffTime,
} from "@/lib/wc-fixture-kickoff";
import { cn } from "@/lib/utils";

type FixtureKickoffTimeProps = {
  iso: string;
  className?: string;
};

/** EDT / GMT / visitor local time (browser timezone). */
export function FixtureKickoffTime({ iso, className }: FixtureKickoffTimeProps) {
  const league = formatDualTimezoneKickoffTime(iso);
  const [local, setLocal] = useState<string | null>(null);

  useEffect(() => {
    setLocal(formatLocalKickoffTime(iso));
  }, [iso]);

  return (
    <span className={cn("tabular-nums", className)} suppressHydrationWarning>
      {local ? `${league} / ${local}` : league}
    </span>
  );
}
