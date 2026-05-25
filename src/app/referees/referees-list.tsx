"use client";

import { Search } from "lucide-react";
import { useDeferredValue, useMemo, useState } from "react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  refereeSiteDisplayName,
  type SiteRefereeRow,
} from "@/lib/referees/site-referees-types";

type RefereesListProps = {
  referees: SiteRefereeRow[];
  headshots: Record<string, string>;
};

function formatApprovedDate(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function RefereesList({ referees, headshots }: RefereesListProps) {
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);

  const filtered = useMemo(() => {
    const q = deferredQuery.trim().toLowerCase();
    if (!q) return referees;
    return referees.filter((ref) => {
      const name = refereeSiteDisplayName(ref).toLowerCase();
      return (
        name.includes(q) ||
        (ref.tier?.toLowerCase().includes(q) ?? false) ||
        (ref.discord_username?.toLowerCase().includes(q) ?? false) ||
        (ref.roblox_user_id?.includes(q) ?? false)
      );
    });
  }, [deferredQuery, referees]);

  return (
    <>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-white/45" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by Roblox name or tier"
            aria-label="Search referees"
            className="h-11 rounded-full border-white/15 bg-white/5 pl-10 pr-10 text-sm text-white placeholder:text-white/45 focus-visible:border-white/30 focus-visible:ring-white/20 dark:bg-white/5"
          />
          {query ? (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full px-2 py-0.5 text-xs font-semibold text-white/55 transition hover:bg-white/10 hover:text-white"
              aria-label="Clear search"
            >
              Clear
            </button>
          ) : null}
        </div>

        <Badge
          variant="outline"
          className="h-9 shrink-0 gap-2 self-start border-white/15 bg-white/5 px-3 text-white/85 sm:self-auto"
        >
          <span className="h-1.5 w-1.5 rounded-full bg-amber-400 shadow-[0_0_10px_rgba(251,191,36,0.9)]" />
          {filtered.length === referees.length
            ? `${referees.length} on roster`
            : `${filtered.length} of ${referees.length}`}
        </Badge>
      </div>

      {filtered.length === 0 ? (
        <Card className="py-8">
          <CardContent className="text-center text-sm text-white/65">
            {referees.length === 0
              ? "No referees on the roster yet. Apply in the VF Referee Discord."
              : `No referees match \"${query}\".`}
          </CardContent>
        </Card>
      ) : (
        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((ref) => {
            const displayName = refereeSiteDisplayName(ref);
            const headshot = ref.roblox_user_id
              ? headshots[ref.roblox_user_id]
              : undefined;
            const approved = formatApprovedDate(ref.approved_at);
            const robloxProfile = ref.roblox_user_id
              ? `https://www.roblox.com/users/${ref.roblox_user_id}/profile`
              : null;

            return (
              <Card
                key={ref.id}
                className="h-full gap-0 py-0 transition hover:bg-white/[0.07] hover:ring-white/25"
              >
                <div className="flex items-start gap-3 px-4 py-4">
                  <Avatar
                    size="lg"
                    className="bg-[#083696]/40 shadow-[0_8px_24px_-10px_rgba(8,54,150,0.7)] ring-1 ring-white/15"
                  >
                    {headshot ? (
                      <AvatarImage
                        src={headshot}
                        alt={`${displayName} Roblox headshot`}
                      />
                    ) : null}
                    <AvatarFallback className="bg-[#083696] text-sm font-black uppercase text-white">
                      {displayName.slice(0, 2)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                      {robloxProfile ? (
                        <a
                          href={robloxProfile}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="truncate text-base font-semibold tracking-tight text-white underline-offset-2 hover:underline"
                        >
                          {displayName}
                        </a>
                      ) : (
                        <p className="truncate text-base font-semibold tracking-tight text-white">
                          {displayName}
                        </p>
                      )}
                      {ref.status === "suspended" ? (
                        <Badge
                          variant="outline"
                          className="border-red-400/40 bg-red-500/10 text-[10px] uppercase tracking-wide text-red-200"
                        >
                          Suspended
                        </Badge>
                      ) : null}
                    </div>
                    {ref.tier ? (
                      <p className="mt-1 text-xs font-medium uppercase tracking-wide text-amber-200/90">
                        {ref.tier}
                      </p>
                    ) : null}
                    <p className="mt-2 text-xs text-white/55">
                      {ref.assignment_count === 1
                        ? "1 assignment"
                        : `${ref.assignment_count} assignments`}
                      {approved ? ` · Since ${approved}` : ""}
                    </p>
                  </div>
                </div>
              </Card>
            );
          })}
        </section>
      )}
    </>
  );
}