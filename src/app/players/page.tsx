import { SiteNav } from "@/components/site-nav";
import { getRobloxHeadshots } from "@/lib/roblox";
import { createSupabaseServerClient } from "@/lib/supabase-server";

import { PlayersList, type PlayerRow } from "./players-list";

async function getPlayers(): Promise<PlayerRow[]> {
  try {
    const supabase = createSupabaseServerClient();
    const result = await supabase
      .from("players")
      .select(
        "id, roblox_username, roblox_user_id, discord_username, status, position",
      )
      .order("roblox_username", { ascending: true });

    if (result.error) return [];
    return (result.data ?? []) as PlayerRow[];
  } catch {
    return [];
  }
}

export default async function PlayersPage() {
  const players = await getPlayers();
  const headshotsMap = await getRobloxHeadshots(
    players.map((p) => p.roblox_user_id),
  );
  const headshots = Object.fromEntries(headshotsMap);

  return (
    <main className="relative min-h-screen w-full overflow-hidden text-white">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-5 pb-16 pt-6 sm:px-8 sm:pt-10">
        <SiteNav active="players" />

        <section>
          <p className="text-[10px] font-semibold uppercase tracking-[0.32em] text-white/55">
            Roster
          </p>
          <h1 className="mt-2 text-4xl font-semibold tracking-tight sm:text-5xl">
            Players
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-white/70 sm:text-base">
            The full player database. Tap a card to reveal Roblox and Discord
            identifiers, position, and status.
          </p>
        </section>

        <PlayersList players={players} headshots={headshots} />
      </div>
    </main>
  );
}
