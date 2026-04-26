import {
  ArrowLeft,
  Award,
  CalendarDays,
  Medal,
  Send,
  Star,
  Target,
  Trophy,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { TeamCrest } from "@/app/teams/team-crest";
import { getTeamBySlug, type Team } from "@/app/teams/teams-data";
import { SiteNav } from "@/components/site-nav";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getRobloxHeadshots } from "@/lib/roblox";
import { createSupabaseServerClient } from "@/lib/supabase-server";

type PlayerProfileRow = {
  id: string;
  roblox_username: string;
  roblox_user_id: string;
  discord_username: string | null;
  status: string;
  position: string | null;
  goals_total?: number | null;
  assists_total?: number | null;
  avg_rating?: number | null;
  appearances_total?: number | null;
  trophies?: Trophy[] | null;
  accolades?: Accolade[] | null;
};

type Trophy = {
  title: string;
  season?: number;
  team?: string;
};

type Accolade = {
  title: string;
  season?: number;
  meta?: string;
};

type CareerEntryRow = {
  team_slug: string;
  season: number;
  games?: number | null;
};

type CareerEntry = CareerEntryRow & {
  team?: Team;
};

async function getPlayer(
  username: string,
): Promise<PlayerProfileRow | null> {
  try {
    const supabase = createSupabaseServerClient();
    const result = await supabase
      .from("players")
      .select("*")
      .ilike("roblox_username", username)
      .maybeSingle();

    if (result.error) return null;
    return (result.data as PlayerProfileRow | null) ?? null;
  } catch {
    return null;
  }
}

async function getPlayerCareer(playerId: string): Promise<CareerEntry[]> {
  try {
    const supabase = createSupabaseServerClient();
    const result = await supabase
      .from("player_team_seasons")
      .select("team_slug, season, games")
      .eq("player_id", playerId)
      .order("season", { ascending: true });

    if (result.error) return [];
    const rows = (result.data ?? []) as CareerEntryRow[];
    return rows.map((row) => ({ ...row, team: getTeamBySlug(row.team_slug) }));
  } catch {
    return [];
  }
}

type PlayerPageParams = { username: string };

export async function generateMetadata({
  params,
}: {
  params: Promise<PlayerPageParams>;
}): Promise<Metadata> {
  const { username } = await params;
  const decoded = decodeURIComponent(username);
  return {
    title: `${decoded} · VF League Database`,
    description: `${decoded}'s VF profile: stats, career, trophies, and accolades.`,
  };
}

export default async function PlayerDetailPage({
  params,
}: {
  params: Promise<PlayerPageParams>;
}) {
  const { username } = await params;
  const decoded = decodeURIComponent(username);
  const player = await getPlayer(decoded);

  if (!player) notFound();

  const headshotsMap = await getRobloxHeadshots([player.roblox_user_id]);
  const headshot = headshotsMap.get(player.roblox_user_id);
  const career = await getPlayerCareer(player.id);

  const stats = {
    goals: player.goals_total ?? 0,
    assists: player.assists_total ?? 0,
    avgRating: player.avg_rating ?? null,
    appearances: player.appearances_total ?? 0,
    trophies: player.trophies ?? [],
    accolades: player.accolades ?? [],
  };

  return (
    <main className="relative min-h-screen w-full overflow-hidden text-white">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-5 pb-16 pt-6 sm:px-8 sm:pt-10">
        <SiteNav active="players" />

        <Link
          href="/players"
          className="inline-flex w-fit items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.2em] text-white/65 transition hover:text-white"
        >
          <ArrowLeft className="size-3.5" />
          All players
        </Link>

        <section className="flex flex-col items-center gap-6 text-center sm:flex-row sm:items-center sm:gap-8 sm:text-left">
          <Avatar className="!size-32 shrink-0 bg-[#083696]/40 shadow-[0_16px_48px_-12px_rgba(8,54,150,0.8)] ring-2 ring-white/20 sm:!size-40">
            {headshot ? (
              <AvatarImage
                src={headshot}
                alt={`${player.roblox_username} Roblox headshot`}
              />
            ) : null}
            <AvatarFallback className="bg-[#083696] text-3xl font-black uppercase text-white">
              {player.roblox_username.slice(0, 2)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.32em] text-white/55">
              VF Profile
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
              {player.roblox_username}
            </h1>
            <p className="mt-2 text-sm text-white/65">
              {player.position ?? "Position unset"}
            </p>
            <div className="mt-3 flex flex-wrap justify-center gap-1.5 sm:justify-start">
              <Badge
                variant="outline"
                className="border-white/15 capitalize text-white/70"
              >
                {player.status}
              </Badge>
              {player.discord_username ? (
                <Badge
                  variant="outline"
                  className="border-white/15 text-white/70"
                >
                  Discord linked
                </Badge>
              ) : null}
            </div>
          </div>
        </section>

        <section className="flex flex-col gap-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.32em] text-white/55">
              Career stats
            </p>
            <h2 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">
              All-time
            </h2>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <StatTile
              label="Goals"
              value={stats.goals}
              icon={Target}
              accent="emerald"
            />
            <StatTile
              label="Assists"
              value={stats.assists}
              icon={Send}
              accent="sky"
            />
            <StatTile
              label="Avg Rating"
              value={
                typeof stats.avgRating === "number"
                  ? stats.avgRating.toFixed(1)
                  : "—"
              }
              icon={Star}
              accent="amber"
            />
            <StatTile
              label="Appearances"
              value={stats.appearances}
              icon={CalendarDays}
              accent="violet"
            />
            <StatTile
              label="Trophies"
              value={stats.trophies.length}
              icon={Trophy}
              accent="yellow"
            />
            <StatTile
              label="Accolades"
              value={stats.accolades.length}
              icon={Medal}
              accent="rose"
            />
          </div>
        </section>

        <section className="flex flex-col gap-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.32em] text-white/55">
              Career
            </p>
            <h2 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">
              Teams &amp; seasons
            </h2>
          </div>

          {career.length === 0 ? (
            <Card className="py-8">
              <CardContent className="flex flex-col items-center gap-2 text-center">
                <p className="text-sm font-semibold text-white">
                  No career history yet.
                </p>
                <p className="max-w-md text-xs text-white/55">
                  Once a{" "}
                  <code className="rounded bg-white/10 px-1.5 py-0.5 text-white/80">
                    player_team_seasons
                  </code>{" "}
                  table exists with{" "}
                  <code className="rounded bg-white/10 px-1.5 py-0.5 text-white/80">
                    player_id
                  </code>
                  ,{" "}
                  <code className="rounded bg-white/10 px-1.5 py-0.5 text-white/80">
                    team_slug
                  </code>
                  ,{" "}
                  <code className="rounded bg-white/10 px-1.5 py-0.5 text-white/80">
                    season
                  </code>
                  , and{" "}
                  <code className="rounded bg-white/10 px-1.5 py-0.5 text-white/80">
                    games
                  </code>{" "}
                  rows, this player&apos;s teams and games will appear here.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="flex flex-col gap-2">
              {career.map((entry) => (
                <CareerRow key={`${entry.season}-${entry.team_slug}`} entry={entry} />
              ))}
            </div>
          )}
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <Card className="gap-3 py-5">
            <CardHeader className="flex flex-row items-center gap-3">
              <div className="flex size-9 items-center justify-center rounded-lg bg-amber-400/20 text-amber-200 ring-1 ring-amber-300/30">
                <Trophy className="size-4" />
              </div>
              <div>
                <CardTitle className="text-base font-semibold">
                  Trophies
                </CardTitle>
                <CardDescription className="text-white/55">
                  Team championships and cup wins.
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              {stats.trophies.length === 0 ? (
                <p className="text-sm text-white/55">No trophies yet.</p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {stats.trophies.map((trophy, idx) => (
                    <ListRow
                      key={idx}
                      icon={<Trophy className="size-3.5 text-amber-300" />}
                      title={trophy.title}
                      meta={[
                        trophy.season ? `Season ${trophy.season}` : null,
                        trophy.team ?? null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    />
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card className="gap-3 py-5">
            <CardHeader className="flex flex-row items-center gap-3">
              <div className="flex size-9 items-center justify-center rounded-lg bg-fuchsia-400/15 text-fuchsia-200 ring-1 ring-fuchsia-300/25">
                <Star className="size-4" />
              </div>
              <div>
                <CardTitle className="text-base font-semibold">
                  Personal Accolades
                </CardTitle>
                <CardDescription className="text-white/55">
                  Individual awards and recognitions.
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              {stats.accolades.length === 0 ? (
                <p className="text-sm text-white/55">No accolades yet.</p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {stats.accolades.map((accolade, idx) => (
                    <ListRow
                      key={idx}
                      icon={<Medal className="size-3.5 text-fuchsia-200" />}
                      title={accolade.title}
                      meta={[
                        accolade.season ? `Season ${accolade.season}` : null,
                        accolade.meta ?? null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    />
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </section>

        <Card className="gap-3 py-5">
          <CardHeader className="flex flex-row items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-lg bg-white/10 text-white/85 ring-1 ring-white/15">
              <Award className="size-4" />
            </div>
            <div>
              <CardTitle className="text-base font-semibold">Identity</CardTitle>
              <CardDescription className="text-white/55">
                Linked accounts and league records.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2 sm:grid-cols-2">
              <Row label="Roblox" value={player.roblox_username} />
              <Row label="Roblox ID" value={player.roblox_user_id} />
              <Row
                label="Discord"
                value={player.discord_username ?? "Not linked"}
              />
              <Row
                label="Position"
                value={player.position ?? "Not set"}
              />
            </div>
          </CardContent>
        </Card>

        <a
          href={`https://www.roblox.com/users/${player.roblox_user_id}/profile`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex w-fit items-center justify-center self-start rounded-md bg-white px-5 py-2.5 text-sm font-semibold text-[#083696] transition hover:bg-white/90"
        >
          Open Roblox Profile
        </a>
      </div>
    </main>
  );
}

type StatAccent =
  | "emerald"
  | "sky"
  | "amber"
  | "violet"
  | "yellow"
  | "rose";

const STAT_ACCENTS: Record<
  StatAccent,
  {
    glow: string;
    iconBg: string;
    iconRing: string;
    iconText: string;
    border: string;
  }
> = {
  emerald: {
    glow: "bg-emerald-400/25",
    iconBg: "bg-emerald-400/15",
    iconRing: "ring-emerald-300/30",
    iconText: "text-emerald-200",
    border: "hover:border-emerald-300/30",
  },
  sky: {
    glow: "bg-sky-400/25",
    iconBg: "bg-sky-400/15",
    iconRing: "ring-sky-300/30",
    iconText: "text-sky-200",
    border: "hover:border-sky-300/30",
  },
  amber: {
    glow: "bg-amber-400/25",
    iconBg: "bg-amber-400/15",
    iconRing: "ring-amber-300/30",
    iconText: "text-amber-200",
    border: "hover:border-amber-300/30",
  },
  violet: {
    glow: "bg-violet-400/25",
    iconBg: "bg-violet-400/15",
    iconRing: "ring-violet-300/30",
    iconText: "text-violet-200",
    border: "hover:border-violet-300/30",
  },
  yellow: {
    glow: "bg-yellow-300/25",
    iconBg: "bg-yellow-300/15",
    iconRing: "ring-yellow-200/30",
    iconText: "text-yellow-100",
    border: "hover:border-yellow-200/30",
  },
  rose: {
    glow: "bg-rose-400/25",
    iconBg: "bg-rose-400/15",
    iconRing: "ring-rose-300/30",
    iconText: "text-rose-200",
    border: "hover:border-rose-300/30",
  },
};

function StatTile({
  label,
  value,
  icon: Icon,
  accent,
}: {
  label: string;
  value: string | number;
  icon: LucideIcon;
  accent: StatAccent;
}) {
  const c = STAT_ACCENTS[accent];
  return (
    <div
      className={`group relative overflow-hidden rounded-xl border border-white/10 bg-gradient-to-br from-white/[0.06] to-[#02103f]/40 p-4 transition ${c.border}`}
    >
      <div
        aria-hidden
        className={`pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full blur-2xl transition group-hover:scale-110 ${c.glow}`}
      />
      <div className="relative flex flex-col gap-3">
        <span
          className={`inline-flex size-9 items-center justify-center rounded-lg ring-1 ${c.iconBg} ${c.iconRing} ${c.iconText}`}
        >
          <Icon className="size-4" />
        </span>
        <div className="flex flex-col gap-0.5">
          <p className="text-3xl font-bold tracking-tight text-white">
            {value}
          </p>
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/55">
            {label}
          </p>
        </div>
      </div>
    </div>
  );
}

function CareerRow({ entry }: { entry: CareerEntry }) {
  const teamName = entry.team?.name ?? entry.team_slug;
  const content = (
    <div className="flex items-center gap-4 px-4 py-3">
      <Badge
        variant="outline"
        className="shrink-0 border-white/15 px-2.5 py-0.5 font-semibold text-white/85"
      >
        Season {entry.season}
      </Badge>
      <div className="flex min-w-0 flex-1 items-center gap-3">
        {entry.team ? (
          <TeamCrest team={entry.team} size="sm" />
        ) : (
          <div className="size-10 shrink-0 rounded-md bg-white/5" />
        )}
        <p className="truncate text-base font-semibold text-white">
          {teamName}
        </p>
      </div>
      <div className="shrink-0 text-right">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/55">
          Games
        </p>
        <p className="text-base font-semibold text-white">
          {entry.games ?? "—"}
        </p>
      </div>
    </div>
  );

  if (entry.team) {
    return (
      <Link
        href={`/teams/${entry.team.slug}`}
        className="block rounded-xl outline-none transition focus-visible:ring-2 focus-visible:ring-white/40"
      >
        <Card className="gap-0 py-0 transition hover:bg-white/[0.07] hover:ring-white/25">
          {content}
        </Card>
      </Link>
    );
  }

  return (
    <Card className="gap-0 py-0">{content}</Card>
  );
}

function ListRow({
  icon,
  title,
  meta,
}: {
  icon: React.ReactNode;
  title: string;
  meta?: string;
}) {
  return (
    <li className="flex items-center gap-3 rounded-md border border-white/10 bg-[#02103f]/65 px-3 py-2.5">
      <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-white/5">
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-white">{title}</p>
        {meta ? (
          <p className="truncate text-[11px] text-white/55">{meta}</p>
        ) : null}
      </div>
    </li>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-md border border-white/10 bg-[#02103f]/65 px-3 py-2">
      <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/55">
        {label}
      </span>
      <span className="truncate pl-3 text-right text-sm font-medium text-white">
        {value}
      </span>
    </div>
  );
}
