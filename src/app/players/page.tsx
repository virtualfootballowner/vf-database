import { SiteNav } from "@/components/site-nav";
import { getRobloxHeadshots, isVerifiedRobloxUserId } from "@/lib/roblox";
import { createSupabaseServerClient } from "@/lib/supabase-server";

import { PlayersList, type PlayerRow } from "./players-list";

/** Always render fresh: new players appear immediately after staff approval, no redeploy needed. */
export const dynamic = "force-dynamic";

type VerifiedPlayerRow = PlayerRow & { roblox_user_id: string };

function isVerifiedPlayerRow(p: PlayerRow): p is VerifiedPlayerRow {
  return isVerifiedRobloxUserId(p.roblox_user_id);
}

async function getPlayers(): Promise<PlayerRow[]> {
  try {
    const supabase = createSupabaseServerClient();
    const result = await supabase
      .from("players")
      .select(
        "id, roblox_username, roblox_user_id, discord_username, position, discord_banned_at",
      )
      .order("roblox_username", { ascending: true });

    if (result.error) return [];
    return (result.data ?? []) as PlayerRow[];
  } catch {
    return [];
  }
}

export default async function PlayersPage() {
  const allPlayers = await getPlayers();
  const players = allPlayers.filter(isVerifiedPlayerRow);
  const headshotsMap = await getRobloxHeadshots(
    players.map((p) => p.roblox_user_id),
  );
  const headshots = Object.fromEntries(headshotsMap);

  return (
    <main className="relative min-h-dvh min-w-0 w-full overflow-x-clip text-white">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 pb-16 pt-5 sm:px-6 sm:pt-8 md:px-8 md:pt-10">
        <SiteNav active="players" />

        <section>
          <p className="text-[10px] font-semibold uppercase tracking-[0.32em] text-white/55">
            Roster
          </p>
          <h1 className="mt-2 text-4xl font-semibold tracking-tight sm:text-5xl">
            Players
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-white/70 sm:text-base">
            Players with a linked Roblox user id. Tap a card for Discord, position,
            and stats.
          </p>
        </section>

        <PlayersList players={players} headshots={headshots} />
      </div>
    </main>
  );
}
