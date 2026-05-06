import {
  ArrowLeft,
  Award,
  CalendarDays,
  Medal,
  Star,
} from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import { TeamCrest } from "@/app/teams/team-crest";
import type { Team } from "@/app/teams/teams-data";
import { PlayerScrimmageBlock } from "@/components/scrimmage/profile-block";
import { SiteNav } from "@/components/site-nav";
import { TrophyHonorIcon } from "@/components/trophy-honor-icon";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getRobloxHeadshots, isVerifiedRobloxUserId } from "@/lib/roblox";
import { trophyImageForTrophyTitle, TROPHY_IMAGE } from "@/lib/trophy-assets";
import {
  getPlayerMatchAppearances,
  summaryLine,
  type PlayerMatchAppearance,
} from "@/lib/player-match-history";
import { getTeamsCatalog } from "@/lib/site-db";
import { createSupabaseServerClient } from "@/lib/supabase-server";

type PlayerProfileRow = {
  id: string;
  roblox_username: string;
  roblox_user_id: string | null;
  discord_username: string | null;
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

async function getPlayerCareer(
  playerId: string,
  teams: Team[],
): Promise<CareerEntry[]> {
  try {
    const supabase = createSupabaseServerClient();
    const result = await supabase
      .from("player_team_seasons")
      .select("team_slug, season, games")
      .eq("player_id", playerId)
      .order("season", { ascending: true });

    if (result.error) return [];
    const rows = (result.data ?? []) as CareerEntryRow[];
    return rows.map((row) => ({
      ...row,
      team: teams.find((t) => t.slug === row.team_slug),
    }));
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

  if (!player || !isVerifiedRobloxUserId(player.roblox_user_id)) notFound();

  const headshotsMap = await getRobloxHeadshots([player.roblox_user_id]);
  const headshot = headshotsMap.get(player.roblox_user_id);
  const { teams } = await getTeamsCatalog();
  const career = await getPlayerCareer(player.id, teams);
  const appearances = await getPlayerMatchAppearances({
    playerId: player.id,
    robloxUserId: player.roblox_user_id,
    robloxUsername: player.roblox_username,
  });

  const teamBySlug = new Map<string, Team>();
  const teamByName = new Map<string, Team>();
  for (const t of teams) {
    if (t.slug) teamBySlug.set(t.slug, t);
    teamByName.set(t.name.trim().toLowerCase(), t);
  }
  const lookupTeam = (slug: string | null, name: string): Team | undefined => {
    if (slug) {
      const hit = teamBySlug.get(slug);
      if (hit) return hit;
    }
    return teamByName.get(name.trim().toLowerCase());
  };

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
            <StatTile label="Goals" value={stats.goals} />
            <StatTile label="Assists" value={stats.assists} />
            <StatTile
              label="Avg Rating"
              value={
                typeof stats.avgRating === "number"
                  ? stats.avgRating.toFixed(1)
                  : "—"
              }
            />
            <StatTile label="Appearances" value={stats.appearances} />
            <TrophyStatTile trophies={stats.trophies} />
            <StatTile label="Accolades" value={stats.accolades.length} />
          </div>
        </section>

        <PlayerScrimmageBlock
          playerId={player.id}
          robloxUsername={player.roblox_username}
        />

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

        <section className="flex flex-col gap-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.32em] text-white/55">
              Recorded matches
            </p>
            <h2 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">
              Match appearances
            </h2>
            <p className="mt-1 max-w-2xl text-sm text-white/55">
              Games where this player appears on the match sheet (goals,
              assists, cards, MOTM, etc.).
            </p>
          </div>

          {appearances.length === 0 ? (
            <Card className="py-8">
              <CardContent className="flex flex-col items-center gap-2 text-center">
                <p className="text-sm font-semibold text-white">
                  No match events found for this player.
                </p>
                <p className="max-w-md text-xs text-white/55">
                  After stats are imported into{" "}
                  <code className="rounded bg-white/10 px-1.5 py-0.5 text-white/80">
                    match_events
                  </code>{" "}
                  with a linked{" "}
                  <code className="rounded bg-white/10 px-1.5 py-0.5 text-white/80">
                    player_id
                  </code>
                  , or when they appear in the archive CSV under this Roblox
                  account or username, games will list here.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="flex flex-col gap-2">
              {appearances.map((row) => (
                <MatchAppearanceRow
                  key={row.robloxMatchId}
                  row={row}
                  homeTeam={lookupTeam(row.homeSlug, row.homeTeam)}
                  awayTeam={lookupTeam(row.awaySlug, row.awayTeam)}
                />
              ))}
            </div>
          )}
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <Card className="gap-3 py-5">
            <CardHeader className="flex flex-row items-center gap-3">
              <div
                className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-amber-400/20 text-lg leading-none ring-1 ring-amber-300/30"
                aria-hidden
              >
                🏆
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
                      icon={<TrophyHonorIcon trophyTitle={trophy.title} />}
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

function StatTile({ label, value }: { label: string; value: string | number }) {
  return (
    <Card className="gap-1 py-4">
      <CardContent>
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/55">
          {label}
        </p>
        <p className="mt-1.5 text-2xl font-semibold text-white">{value}</p>
      </CardContent>
    </Card>
  );
}

function TrophyStatTile({ trophies }: { trophies: Trophy[] }) {
  const srcs = new Set<string>();
  for (const t of trophies) {
    const s = trophyImageForTrophyTitle(t.title);
    if (s) srcs.add(s);
  }
  return (
    <Card className="gap-1 py-4">
      <CardContent>
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/55">
          Trophies
        </p>
        <p className="mt-1.5 text-2xl font-semibold text-white">
          {trophies.length}
        </p>
        {srcs.size > 0 ? (
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {[...srcs].map((src) => (
              <Image
                key={src}
                src={src}
                alt=""
                width={28}
                height={28}
                className="size-7 object-contain opacity-95"
              />
            ))}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function MatchAppearanceRow({
  row,
  homeTeam,
  awayTeam,
}: {
  row: PlayerMatchAppearance;
  homeTeam: Team | undefined;
  awayTeam: Team | undefined;
}) {
  const summary = summaryLine(row);
  const fftBadge =
    row.fft !== "No" ? (
      <Badge
        variant="outline"
        className="shrink-0 border-amber-400/35 text-[10px] font-semibold uppercase tracking-wider text-amber-100/90"
      >
        {row.fft}
      </Badge>
    ) : null;

  const content = (
    <div className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:gap-4">
      <div className="flex shrink-0 items-center gap-2 text-white/55">
        <CalendarDays className="size-4 shrink-0" />
        <time
          className="text-xs font-semibold tabular-nums text-white/80"
          dateTime={row.date || undefined}
        >
          {row.date || "—"}
        </time>
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex min-w-0 items-center gap-1.5 text-sm font-semibold text-white">
            {homeTeam ? (
              <span className="shrink-0">
                <TeamCrest team={homeTeam} size="xs" />
              </span>
            ) : null}
            <span className="truncate text-white/80">{row.homeTeam}</span>
            <span className="mx-1 shrink-0 text-white/45">
              {row.homeScore}–{row.awayScore}
            </span>
            {awayTeam ? (
              <span className="shrink-0">
                <TeamCrest team={awayTeam} size="xs" />
              </span>
            ) : null}
            <span className="truncate text-white/80">{row.awayTeam}</span>
          </div>
          {fftBadge}
        </div>
        <p className="mt-0.5 text-[11px] text-white/50">
          Season {row.season} · {row.competition} · {row.gameWeek}
        </p>
        {summary ? (
          <p className="mt-1 text-xs font-medium text-cyan-100/90">{summary}</p>
        ) : (
          <p className="mt-1 text-xs text-white/45">Played (no goals / assists)</p>
        )}
      </div>
      <div className="shrink-0 sm:text-right">
        <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/45">
          Match
        </span>
        <p className="mt-0.5 font-mono text-[11px] font-medium text-white/70">
          {row.robloxMatchId}
        </p>
      </div>
    </div>
  );

  return (
    <Link
      href={`/stats/matches/${encodeURIComponent(row.robloxMatchId)}`}
      className="block rounded-xl outline-none transition focus-visible:ring-2 focus-visible:ring-white/40"
    >
      <Card className="gap-0 py-0 transition hover:bg-white/[0.07] hover:ring-white/25">
        {content}
      </Card>
    </Link>
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
      <span className="flex shrink-0 items-center justify-center">{icon}</span>
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
