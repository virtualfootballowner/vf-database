"use client";

import { useEffect, useState } from "react";

import { formatLocalKickoffTime } from "@/lib/wc-fixture-kickoff";
import { cn } from "@/lib/utils";

type FixtureKickoffTimeProps = {
  iso: string;
  className?: string;
};

/** Kickoff in the visitor's browser timezone only. */
export function FixtureKickoffTime({ iso, className }: FixtureKickoffTimeProps) {
  const [local, setLocal] = useState<string | null>(null);

  useEffect(() => {
    setLocal(formatLocalKickoffTime(iso));
  }, [iso]);

  return (
    <span className={cn("tabular-nums", className)} suppressHydrationWarning>
      {local ?? "—"}
    </span>
  );
}
