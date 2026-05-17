"use client";

import { ChevronRight, Search } from "lucide-react";
import Link from "next/link";
import { useDeferredValue, useMemo, useState } from "react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { isDiscordBanActive } from "@/lib/players/discord-ban";

export type PlayerRow = {
  id: string;
  roblox_username: string;
  roblox_user_id: string | null;
  discord_username: string | null;
  position: string | null;
  discord_banned_at?: string | null;
  discord_banned_until?: string | null;
};

type PlayersListProps = {
  players: PlayerRow[];
  headshots: Record<string, string>;
};

export function PlayersList({ players, headshots }: PlayersListProps) {
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);

  const filtered = useMemo(() => {
    const q = deferredQuery.trim().toLowerCase();
    if (!q) return players;
    return players.filter((player) => {
      return (
        player.roblox_username.toLowerCase().includes(q) ||
        (player.position?.toLowerCase().includes(q) ?? false) ||
        (player.discord_username?.toLowerCase().includes(q) ?? false) ||
        (player.roblox_user_id?.toLowerCase().includes(q) ?? false)
      );
    });
  }, [deferredQuery, players]);

  return (
    <>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-white/45" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by username, position, or Discord"
            aria-label="Search players"
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
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.9)]" />
          {filtered.length === players.length
            ? `${players.length} on file`
            : `${filtered.length} of ${players.length}`}
        </Badge>
      </div>

      {filtered.length === 0 ? (
        <Card className="py-8">
          <CardContent className="text-center text-sm text-white/65">
            {players.length === 0
              ? "No players in the database yet."
              : `No players match "${query}".`}
          </CardContent>
        </Card>
      ) : (
        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((player) => {
            const headshot = player.roblox_user_id
              ? headshots[player.roblox_user_id]
              : undefined;
            return (
              <Link
                key={player.id}
                href={`/players/${encodeURIComponent(player.roblox_username)}`}
                className="block rounded-xl outline-none transition focus-visible:ring-2 focus-visible:ring-white/40"
              >
                <Card className="h-full gap-0 py-0 transition hover:bg-white/[0.07] hover:ring-white/25">
                  <div className="flex items-center gap-3 px-4 py-4">
                    <Avatar
                      size="lg"
                      className="bg-[#083696]/40 shadow-[0_8px_24px_-10px_rgba(8,54,150,0.7)] ring-1 ring-white/15"
                    >
                      {headshot ? (
                        <AvatarImage
                          src={headshot}
                          alt={`${player.roblox_username} Roblox headshot`}
                        />
                      ) : null}
                      <AvatarFallback className="bg-[#083696] text-sm font-black uppercase text-white">
                        {player.roblox_username.slice(0, 2)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <div className="flex min-w-0 flex-wrap items-center gap-2">
                        <p className="truncate text-base font-semibold tracking-tight text-white">
                          {player.roblox_username}
                        </p>
                        {isDiscordBanActive({
                          discord_banned_at: player.discord_banned_at ?? null,
                          discord_banned_until: player.discord_banned_until ?? null,
                        }) ? (
                          <Badge
                            variant="outline"
                            className="shrink-0 border-red-400/40 text-[10px] font-semibold uppercase tracking-wider text-red-200/95"
                          >
                            Discord banned
                          </Badge>
                        ) : null}
                      </div>
                      <p className="truncate text-xs text-white/55">
                        {player.position ?? "Position unset"}
                      </p>
                    </div>
                    <ChevronRight className="size-4 shrink-0 text-white/45" />
                  </div>
                </Card>
              </Link>
            );
          })}
        </section>
      )}
    </>
  );
}
