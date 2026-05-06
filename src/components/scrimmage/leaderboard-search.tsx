"use client";

import { Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Input } from "@/components/ui/input";

type Props = {
  initialQuery?: string;
};

/**
 * Tiny client form for the leaderboard. The URL (?q=) is the source of
 * truth — submitting / clearing pushes a new URL and the server re-renders.
 */
export function LeaderboardSearch({ initialQuery = "" }: Props) {
  const router = useRouter();
  const [value, setValue] = useState(initialQuery);

  const submit = (next: string) => {
    const params = new URLSearchParams();
    const trimmed = next.trim();
    if (trimmed.length > 0) params.set("q", trimmed);
    const qs = params.toString();
    router.push(qs ? `/stats/faceit?${qs}` : "/stats/faceit");
  };

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        submit(value);
      }}
      className="flex flex-col gap-2 sm:flex-row sm:items-center"
    >
      <div className="relative flex-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-white/45" />
        <Input
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder="Search by Roblox username"
          aria-label="Search FACEIT leaderboard"
          className="h-11 rounded-full border-white/15 bg-white/5 pl-10 pr-10 text-sm text-white placeholder:text-white/45 focus-visible:border-white/30 focus-visible:ring-white/20 dark:bg-white/5"
        />
        {value ? (
          <button
            type="button"
            onClick={() => {
              setValue("");
              submit("");
            }}
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full px-2 py-0.5 text-xs font-semibold text-white/55 transition hover:bg-white/10 hover:text-white"
            aria-label="Clear search"
          >
            Clear
          </button>
        ) : null}
      </div>
    </form>
  );
}
