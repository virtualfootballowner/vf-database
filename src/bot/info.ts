import type { SupabaseClient } from "@supabase/supabase-js";
import {
  EmbedBuilder,
  MessageFlags,
  PermissionFlagsBits,
  type AutocompleteInteraction,
  type ChatInputCommandInteraction,
  type GuildMember,
} from "discord.js";

import { env } from "@/bot/config";
import { absoluteSiteAssetUrl, fetchTeamLogoUrl } from "@/bot/site-assets";
import {
  buildTeamNameBySlug,
  createBotSupabase,
  loadTeams,
  normalizeTeamInputForLookup,
  resolveTeamForSlashCommand,
  type ResolvedTeam,
  type TeamRow,
} from "@/bot/stats-queries";

/** Verified-only gate for read commands. Mirrors `requireVerifiedRole` in commands.ts. */
async function requireVerifiedRole(
  interaction: ChatInputCommandInteraction,
): Promise<boolean> {
  if (!interaction.guild || !interaction.member) {
    await interaction.reply({
      flags: MessageFlags.Ephemeral,
      content: "Use this command inside the server.",
    });
    return false;
  }
  const member = interaction.member as GuildMember;
  if (!member.roles.cache.has(env.DISCORD_ROVER_VERIFIED_ROLE_ID)) {
    await interaction.reply({
      flags: MessageFlags.Ephemeral,
      content:
        "You need to verify on the website first. Run `/postverify` in the verify channel for the link.",
    });
    return false;
  }
  return true;
}

function formatErr(err: unknown): string {
  if (err instanceof Error && err.message.trim()) return err.message.trim();
  if (typeof err === "string" && err.trim()) return err.trim();
  return "unknown error";
}

/* ------------------------------------------------------------------ */
/*  /help — postverify-style: post once, the embed lives in the channel */
/* ------------------------------------------------------------------ */

export async function handleHelp(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  if (
    !interaction.guild ||
    !interaction.channel?.isTextBased() ||
    !interaction.channel.isSendable()
  ) {
    await interaction.reply({
      flags: MessageFlags.Ephemeral,
      content: "Use this command in a sendable text channel inside the server.",
    });
    return;
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
    await interaction.editReply({
      content: "You need **Manage Server** to post the help index.",
    });
    return;
  }

  const verifiedRole = `<@&${env.DISCORD_ROVER_VERIFIED_ROLE_ID}>`;
  const managerRole = `<@&${env.DISCORD_TEAM_MANAGER_ROLE_ID}>`;

  const embed = new EmbedBuilder()
    .setColor(0x083696)
    .setTitle("VFL Bot · Command index")
    .setDescription(
      [
        "Everything the bot can do, grouped by who can use it.",
        `Most read commands are gated to ${verifiedRole} — verify on the website first.`,
      ].join("\n"),
    )
    .addFields(
      {
        name: "🌐 Public · anyone verified",
        value: [
          "**`/player`** — career profile, goals, assists, trophies",
          "**`/team`** — season record, manager, full squad by position",
          "**`/stats`** — all-time top scorers and assisters",
          "**`/fixtures`** — last 5 results + next 5 fixtures for a club",
          "**`/standings`** — league table for a competition + season",
        ].join("\n"),
        inline: false,
      },
      {
        name: "👤 Players · marketplace",
        value: [
          "**`/freeagent`** — post yourself in the free-agent channel · *6h cooldown*",
        ].join("\n"),
        inline: false,
      },
      {
        name: `🏟️ Club managers · ${managerRole}`,
        value: [
          "**`/contract`** — offer a roster contract to a player",
          "**`/release`** — request to release a player from your roster",
          "**`/friendly`** — post a friendly request in the finder",
          "**`/scouting`** — open trials for a position you’re recruiting",
        ].join("\n"),
        inline: false,
      },
      {
        name: "🛠️ Staff · server managers",
        value: [
          "**`/postverify`** — post the verify card in this channel",
          "**`/help`** — post this command index in this channel",
          "**`/appoint`** — assign a club / nation manager for a season",
          "**`/backlog`** — pending whitelist + release queue",
          "**`/creator-remove`** — delete all VF Create DB rows for a user + strip creator role",
          "**`/kick`** · **`/ban`** — moderation",
        ].join("\n"),
        inline: false,
      },
      {
        name: "Need to verify?",
        value: `Run **\`/postverify\`** in the verify channel — that posts the website link. After signing in with Discord + Roblox you’ll get ${verifiedRole} and unlock these commands.`,
        inline: false,
      },
    )
    .setFooter({
      text: "VFL Bot · This message stays here permanently — repost only if commands change",
    })
    .setTimestamp(new Date());

  try {
    await interaction.channel.send({ embeds: [embed] });
    await interaction.editReply({ content: "Posted." });
  } catch (err) {
    console.error("/help: failed to post:", err);
    await interaction.editReply({
      content:
        "Could not post the help card here (check bot Send Messages / Embed Links).",
    });
  }
}

/* ------------------------------------------------------------------ */
/*  /stats — all-time top scorers + assisters from players totals     */
/*                                                                    */
/*  Uses the canonical `players.goals_total` / `players.assists_total`*/
/*  columns (the same numbers `/player` and the site show). Don't     */
/*  aggregate from `match_events` here — career totals were partly    */
/*  seeded directly into `players` and an event-level count would     */
/*  under-report by a lot.                                            */
/* ------------------------------------------------------------------ */

type LeaderboardEntry = {
  roblox_username: string;
  count: number;
};

async function fetchTopByMetric(
  supabase: SupabaseClient,
  metric: "goals_total" | "assists_total",
  topN: number,
): Promise<LeaderboardEntry[]> {
  const { data, error } = await supabase
    .from("players")
    .select(`roblox_username, ${metric}`)
    .gt(metric, 0)
    .order(metric, { ascending: false })
    .order("roblox_username", { ascending: true })
    .limit(topN);
  if (error) throw error;
  return (data ?? []).map((row) => {
    const r = row as Record<string, unknown>;
    return {
      roblox_username: String(r.roblox_username ?? "Unknown"),
      count: Number(r[metric] ?? 0),
    };
  });
}

async function fetchTotals(
  supabase: SupabaseClient,
): Promise<{ goals: number; assists: number }> {
  const { data, error } = await supabase
    .from("players")
    .select("goals_total, assists_total")
    .or("goals_total.gt.0,assists_total.gt.0")
    .limit(5000);
  if (error) throw error;
  let g = 0;
  let a = 0;
  for (const row of (data ?? []) as {
    goals_total: number | null;
    assists_total: number | null;
  }[]) {
    g += row.goals_total ?? 0;
    a += row.assists_total ?? 0;
  }
  return { goals: g, assists: a };
}

function renderLeaderboard(
  rows: LeaderboardEntry[],
  metricEmoji: string,
  metricLabel: string,
): string {
  if (rows.length === 0) {
    return `*No ${metricLabel} on file yet.*`;
  }
  const medal = (idx: number) =>
    idx === 0
      ? "🥇"
      : idx === 1
        ? "🥈"
        : idx === 2
          ? "🥉"
          : `\`${String(idx + 1).padStart(2, " ")}\``;
  return rows
    .map(
      (row, idx) =>
        `${medal(idx)}  **${row.roblox_username}** · ${metricEmoji} **${row.count}**`,
    )
    .join("\n");
}

export async function handleStats(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  if (!(await requireVerifiedRole(interaction))) return;
  await interaction.deferReply();

  try {
    const supabase = createBotSupabase();
    const [scorers, assisters, totals] = await Promise.all([
      fetchTopByMetric(supabase, "goals_total", 10),
      fetchTopByMetric(supabase, "assists_total", 10),
      fetchTotals(supabase),
    ]);

    const siteBase = env.VFL_SITE_URL.replace(/\/$/, "");
    const hostLabel = env.VFL_SITE_URL.replace(/^https?:\/\//, "").replace(/\/$/, "");

    const embed = new EmbedBuilder()
      .setColor(0x083696)
      .setAuthor({
        name: "VF League · All-time leaderboards",
        url: `${siteBase}/players`,
      })
      .setTitle("All-time goals & assists")
      .setURL(`${siteBase}/players`)
      .setDescription(
        [
          `Aggregated across **every** competition and season on file.`,
          `> **${totals.goals}** total goals · **${totals.assists}** total assists`,
          `[Browse all players on ${hostLabel}](${siteBase}/players)`,
        ].join("\n"),
      )
      .addFields(
        {
          name: "⚽ Top scorers",
          value: renderLeaderboard(scorers, "⚽", "goals").slice(0, 1024),
          inline: true,
        },
        {
          name: "🅰️ Top assisters",
          value: renderLeaderboard(assisters, "🅰️", "assists").slice(0, 1024),
          inline: true,
        },
      )
      .setFooter({
        text: "VF League Database · Same totals as /player and the site",
      })
      .setTimestamp(new Date());

    await interaction.editReply({ embeds: [embed] });
  } catch (err) {
    console.error("/stats failed:", err);
    await interaction.editReply({
      content: `Could not load all-time stats: ${formatErr(err)}`,
    });
  }
}

/* ------------------------------------------------------------------ */
/*  /fixtures <team> — past results + upcoming fixtures               */
/* ------------------------------------------------------------------ */

type ResolvedTeamWithId = ResolvedTeam & { id: string };

async function resolveTeamWithId(
  supabase: SupabaseClient,
  cachedRows: TeamRow[],
  raw: string,
): Promise<ResolvedTeamWithId | null> {
  const base = await resolveTeamForSlashCommand(supabase, cachedRows, raw);
  if (!base) return null;
  const { data, error } = await supabase
    .from("teams")
    .select("id")
    .eq("slug", base.slug)
    .maybeSingle();
  if (error) throw error;
  const id = (data as { id?: string } | null)?.id ?? null;
  if (!id) return null;
  return { ...base, id };
}

type PastMatchRow = {
  id: string;
  season: number | null;
  competition: string | null;
  stage: string;
  scheduled_at: string;
  home_team_id: string;
  away_team_id: string;
  home_score: number | null;
  away_score: number | null;
};

type UpcomingFixtureRow = {
  fixture_code: string;
  season: number;
  competition: string;
  stage: string;
  group_code: string | null;
  home_team_name: string;
  away_team_name: string;
  metadata: Record<string, unknown> | null;
};

/**
 * Build the candidate strings we'll use to match `fixtures.home_team_name` /
 * `fixtures.away_team_name` against a resolved team. Fixtures in DB use
 * shortened forms ("Stafford", "Casole") rather than the canonical
 * `teams.name` ("Stafford FC", "AC Casole"), so we normalize generously.
 */
function buildFixtureNameCandidates(team: ResolvedTeamWithId): string[] {
  const out = new Set<string>();
  const push = (s: string | null | undefined) => {
    if (!s) return;
    const t = s.trim();
    if (t.length > 0) out.add(t);
  };
  push(team.name);
  push(team.abbreviation ?? null);
  // Slug → Title-cased ("ac-casole" → "Ac Casole" — fine for ilike).
  push(team.slug.replace(/-/g, " "));
  // Strip common club suffixes/prefixes.
  const stripped = team.name
    .replace(/\b(FC|AC|FK|CF|SC|SSC|AFC)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
  push(stripped);
  return [...out];
}

async function fetchPastMatchesForTeam(
  supabase: SupabaseClient,
  teamId: string,
): Promise<PastMatchRow[]> {
  const { data, error } = await supabase
    .from("matches")
    .select(
      "id, season, competition, stage, scheduled_at, home_team_id, away_team_id, home_score, away_score",
    )
    .or(`home_team_id.eq.${teamId},away_team_id.eq.${teamId}`)
    .eq("status", "completed")
    .order("scheduled_at", { ascending: false })
    .limit(5);
  if (error) throw error;
  return (data ?? []) as PastMatchRow[];
}

async function fetchUpcomingFixturesForTeam(
  supabase: SupabaseClient,
  team: ResolvedTeamWithId,
): Promise<UpcomingFixtureRow[]> {
  const candidates = buildFixtureNameCandidates(team)
    // PostgREST `.or()` parses commas/parens — strip anything that would break the filter string.
    .map((c) => c.replace(/[,()*]/g, "").trim())
    .filter((c) => c.length >= 3);
  if (candidates.length === 0) return [];
  // PostgREST `.or()` uses `*` as the wildcard token inside ilike patterns.
  const orClauses = candidates
    .flatMap((c) => [
      `home_team_name.ilike.*${c}*`,
      `away_team_name.ilike.*${c}*`,
    ])
    .join(",");
  const { data, error } = await supabase
    .from("fixtures")
    .select(
      "fixture_code, season, competition, stage, group_code, home_team_name, away_team_name, metadata",
    )
    .is("match_id", null)
    .or(orClauses)
    .order("season", { ascending: false })
    .order("round_order", { ascending: true })
    .limit(5);
  if (error) throw error;
  return (data ?? []) as UpcomingFixtureRow[];
}

function renderPastMatches(
  rows: PastMatchRow[],
  team: ResolvedTeamWithId,
  teamNames: Map<string, string>,
  idToName: Map<string, string>,
): string {
  if (rows.length === 0) {
    return "*No completed matches on file yet.*";
  }
  return rows
    .map((m) => {
      const isHome = m.home_team_id === team.id;
      const oppId = isHome ? m.away_team_id : m.home_team_id;
      const oppName = idToName.get(oppId) ?? teamNames.get(oppId) ?? "Unknown";
      const ours = isHome ? m.home_score : m.away_score;
      const theirs = isHome ? m.away_score : m.home_score;
      const result =
        ours == null || theirs == null
          ? "—"
          : ours > theirs
            ? "🟢 W"
            : ours < theirs
              ? "🔴 L"
              : "🟡 D";
      const score = `${ours ?? 0}–${theirs ?? 0}`;
      const venue = isHome ? "vs" : "@";
      const ts = m.scheduled_at
        ? `<t:${Math.floor(new Date(m.scheduled_at).getTime() / 1000)}:R>`
        : "";
      const compTag = m.competition && m.competition !== "—" ? `\`${m.competition.slice(0, 18)}\` · ` : "";
      return `${result}  **${score}**  ${venue} **${oppName}** · ${compTag}S${m.season ?? "?"} ${ts}`;
    })
    .join("\n");
}

function renderUpcomingFixtures(
  rows: UpcomingFixtureRow[],
  team: ResolvedTeamWithId,
): string {
  if (rows.length === 0) {
    return "*No upcoming fixtures scheduled — once the draw / next slate is set, they'll appear here.*";
  }
  return rows
    .map((f) => {
      const candidates = buildFixtureNameCandidates(team).map((c) => c.toLowerCase());
      const home = f.home_team_name?.trim() ?? "";
      const away = f.away_team_name?.trim() ?? "";
      const isHome = candidates.some((c) => home.toLowerCase().includes(c));
      const oppRaw = isHome ? away : home;
      const seedFallback = (() => {
        const meta = f.metadata ?? {};
        const homeSeed = (meta as { home_seed?: string }).home_seed;
        const awaySeed = (meta as { away_seed?: string }).away_seed;
        if (isHome && awaySeed) return `slot ${awaySeed}`;
        if (!isHome && homeSeed) return `slot ${homeSeed}`;
        return "TBD";
      })();
      const opp = oppRaw.length > 0 ? oppRaw : seedFallback;
      const venue = isHome ? "vs" : "@";
      const stageLabel =
        f.stage === "Group" && f.group_code
          ? `Group ${f.group_code}`
          : f.stage;
      return `🆚  ${venue} **${opp}** · \`${f.competition}\` · ${stageLabel} · S${f.season} · \`${f.fixture_code}\``;
    })
    .join("\n");
}

export async function handleFixtures(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  if (!(await requireVerifiedRole(interaction))) return;
  const teamRaw = interaction.options.getString("team", true);
  await interaction.deferReply();

  try {
    const supabase = createBotSupabase();
    const teamRows = await loadTeams(supabase);
    const team = await resolveTeamWithId(supabase, teamRows, teamRaw);
    if (!team) {
      await interaction.editReply({
        content:
          "Could not resolve that club. Use the **team** autocomplete or the exact slug (e.g. `andover-fc`).",
      });
      return;
    }

    const [past, upcoming, teamNames] = await Promise.all([
      fetchPastMatchesForTeam(supabase, team.id),
      fetchUpcomingFixturesForTeam(supabase, team),
      buildTeamNameBySlug(supabase),
    ]);

    // Resolve opponent UUIDs → names (matches table uses ids).
    const opponentIds = [
      ...new Set(
        past.map((m) =>
          m.home_team_id === team.id ? m.away_team_id : m.home_team_id,
        ),
      ),
    ];
    const idToName = new Map<string, string>();
    if (opponentIds.length > 0) {
      const { data: oppRows, error: oppErr } = await supabase
        .from("teams")
        .select("id, name")
        .in("id", opponentIds);
      if (oppErr) throw oppErr;
      for (const r of (oppRows ?? []) as { id: string; name: string }[]) {
        idToName.set(r.id, r.name);
      }
    }

    const siteBase = env.VFL_SITE_URL.replace(/\/$/, "");
    const teamUrl = `${siteBase}/teams/${encodeURIComponent(team.slug)}`;
    const dbLogo = await fetchTeamLogoUrl(supabase, team.slug, siteBase);
    const logoUrl =
      dbLogo ?? absoluteSiteAssetUrl(team.logo_url ?? null, siteBase);

    const embed = new EmbedBuilder()
      .setColor(0x083696)
      .setAuthor({
        name: `${team.name} · VF League`,
        iconURL: logoUrl ?? undefined,
        url: teamUrl,
      })
      .setTitle("Fixtures & results")
      .setURL(teamUrl)
      .setDescription(
        [
          `Last 5 completed matches and the next 5 scheduled fixtures for **${team.name}**.`,
          `[Team page on the site](${teamUrl})`,
        ].join("\n"),
      )
      .addFields(
        {
          name: "📜 Last 5 results",
          value: renderPastMatches(past, team, teamNames, idToName).slice(0, 1024),
          inline: false,
        },
        {
          name: "📅 Next 5 fixtures",
          value: renderUpcomingFixtures(upcoming, team).slice(0, 1024),
          inline: false,
        },
      )
      .setFooter({ text: "VF League Database · Future fixtures appear once drawn" })
      .setTimestamp(new Date());

    if (logoUrl) embed.setThumbnail(logoUrl);

    await interaction.editReply({ embeds: [embed] });
  } catch (err) {
    console.error("/fixtures failed:", err);
    await interaction.editReply({
      content: `Could not load fixtures: ${formatErr(err)}`,
    });
  }
}

/* ------------------------------------------------------------------ */
/*  /standings <competition> <season> — table aggregated from matches */
/* ------------------------------------------------------------------ */

type StandingsRow = {
  team_id: string;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  gf: number;
  ga: number;
};

const COMPETITION_CATALOG: { competition: string; seasons: number[] }[] = [
  { competition: "EuroLeague", seasons: [1] },
  { competition: "EuroBlox Playoffs", seasons: [1] },
  { competition: "British Premier", seasons: [2] },
  { competition: "Serie Italia", seasons: [2] },
  { competition: "World Cup", seasons: [3] },
];

async function loadCompetitionCatalog(
  supabase: SupabaseClient,
): Promise<{ competition: string; seasons: number[] }[]> {
  // Merge known catalog with whatever distinct values currently live in matches/fixtures.
  const fromCatalog = new Map<string, Set<number>>();
  for (const c of COMPETITION_CATALOG) {
    fromCatalog.set(c.competition, new Set(c.seasons));
  }
  try {
    const { data: m, error: mErr } = await supabase
      .from("matches")
      .select("competition, season")
      .not("competition", "is", null)
      .limit(5000);
    if (mErr) throw mErr;
    for (const row of (m ?? []) as { competition: string | null; season: number | null }[]) {
      if (!row.competition || row.competition === "—") continue;
      const set = fromCatalog.get(row.competition) ?? new Set<number>();
      if (row.season != null) set.add(row.season);
      fromCatalog.set(row.competition, set);
    }
    const { data: f, error: fErr } = await supabase
      .from("fixtures")
      .select("competition, season")
      .not("competition", "is", null)
      .limit(5000);
    if (fErr) throw fErr;
    for (const row of (f ?? []) as { competition: string | null; season: number | null }[]) {
      if (!row.competition) continue;
      const set = fromCatalog.get(row.competition) ?? new Set<number>();
      if (row.season != null) set.add(row.season);
      fromCatalog.set(row.competition, set);
    }
  } catch (err) {
    // Fall back to catalog only — query failure shouldn't break autocomplete.
    console.error("loadCompetitionCatalog: query failed:", err);
  }
  return [...fromCatalog.entries()]
    .map(([competition, seasonsSet]) => ({
      competition,
      seasons: [...seasonsSet].sort((a, b) => a - b),
    }))
    .sort((a, b) => a.competition.localeCompare(b.competition));
}

export async function handleCompetitionAutocomplete(
  interaction: AutocompleteInteraction,
): Promise<void> {
  const focused = interaction.options.getFocused(true);
  if (focused.name !== "competition") return;
  try {
    const supabase = createBotSupabase();
    const catalog = await loadCompetitionCatalog(supabase);
    const q = String(focused.value ?? "").trim().toLowerCase();
    const filtered = catalog
      .map((c) => {
        const seasonsLabel =
          c.seasons.length > 0
            ? ` · S${c.seasons.join(", S")}`
            : "";
        return {
          name: `${c.competition}${seasonsLabel}`.slice(0, 100),
          value: c.competition.slice(0, 100),
        };
      })
      .filter((c) => !q || c.name.toLowerCase().includes(q))
      .slice(0, 25);
    await interaction.respond(filtered);
  } catch {
    await interaction.respond([]);
  }
}

async function aggregateStandings(
  supabase: SupabaseClient,
  competition: string,
  season: number,
): Promise<StandingsRow[]> {
  const { data, error } = await supabase
    .from("matches")
    .select(
      "home_team_id, away_team_id, home_score, away_score, status, season, competition",
    )
    .eq("competition", competition)
    .eq("season", season)
    .eq("status", "completed")
    .limit(5000);
  if (error) throw error;
  type Row = {
    home_team_id: string;
    away_team_id: string;
    home_score: number | null;
    away_score: number | null;
  };
  const tally = new Map<string, StandingsRow>();
  const get = (id: string): StandingsRow => {
    let cur = tally.get(id);
    if (!cur) {
      cur = { team_id: id, played: 0, wins: 0, draws: 0, losses: 0, gf: 0, ga: 0 };
      tally.set(id, cur);
    }
    return cur;
  };
  for (const m of (data ?? []) as Row[]) {
    if (m.home_score == null || m.away_score == null) continue;
    const h = get(m.home_team_id);
    const a = get(m.away_team_id);
    h.played += 1;
    a.played += 1;
    h.gf += m.home_score;
    h.ga += m.away_score;
    a.gf += m.away_score;
    a.ga += m.home_score;
    if (m.home_score > m.away_score) {
      h.wins += 1;
      a.losses += 1;
    } else if (m.home_score < m.away_score) {
      a.wins += 1;
      h.losses += 1;
    } else {
      h.draws += 1;
      a.draws += 1;
    }
  }
  return [...tally.values()];
}

function points(row: StandingsRow): number {
  return row.wins * 3 + row.draws;
}

export async function handleStandings(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  if (!(await requireVerifiedRole(interaction))) return;
  const competition = interaction.options.getString("competition", true).trim();
  const season = interaction.options.getInteger("season", true);
  await interaction.deferReply();

  try {
    const supabase = createBotSupabase();
    const rows = await aggregateStandings(supabase, competition, season);

    if (rows.length === 0) {
      const embed = new EmbedBuilder()
        .setColor(0x6b7280)
        .setTitle(`${competition} · Season ${season}`)
        .setDescription(
          [
            `*No completed matches on file for this competition / season yet.*`,
            "Once games are played and synced, the table will fill in automatically.",
          ].join("\n"),
        )
        .setFooter({ text: "VF League Database · Standings" })
        .setTimestamp(new Date());
      await interaction.editReply({ embeds: [embed] });
      return;
    }

    rows.sort((a, b) => {
      const dp = points(b) - points(a);
      if (dp !== 0) return dp;
      const dgd = (b.gf - b.ga) - (a.gf - a.ga);
      if (dgd !== 0) return dgd;
      return b.gf - a.gf;
    });

    const teamIds = rows.map((r) => r.team_id);
    const { data: teamRows, error: tErr } = await supabase
      .from("teams")
      .select("id, name, abbreviation, slug")
      .in("id", teamIds);
    if (tErr) throw tErr;
    const idToTeam = new Map(
      (teamRows ?? []).map((t) => [
        t.id as string,
        {
          name: t.name as string,
          abbr: (t.abbreviation as string | null) ?? null,
          slug: (t.slug as string | null) ?? null,
        },
      ]),
    );

    const lines: string[] = [];
    rows.forEach((row, idx) => {
      const t = idToTeam.get(row.team_id);
      const labelRaw =
        t?.abbr?.trim() ??
        t?.name ??
        row.team_id.slice(0, 6);
      const label = labelRaw.length > 14 ? labelRaw.slice(0, 13) + "…" : labelRaw;
      const gd = row.gf - row.ga;
      const gdStr = gd > 0 ? `+${gd}` : `${gd}`;
      const rank = String(idx + 1).padStart(2, " ");
      lines.push(
        `\`${rank} ${label.padEnd(14, " ")} ` +
          `${String(row.played).padStart(2, " ")} ` +
          `${String(row.wins).padStart(2, " ")} ` +
          `${String(row.draws).padStart(2, " ")} ` +
          `${String(row.losses).padStart(2, " ")} ` +
          `${gdStr.padStart(4, " ")} ` +
          `${String(points(row)).padStart(3, " ")}\``,
      );
    });

    const header =
      `\`#  ${"Team".padEnd(14, " ")} ` +
      `${"P".padStart(2, " ")} ${"W".padStart(2, " ")} ${"D".padStart(2, " ")} ${"L".padStart(2, " ")} ${"GD".padStart(4, " ")} ${"Pts".padStart(3, " ")}\``;

    const description = [
      `**${competition}** · Season **${season}**`,
      `${rows.length} ${rows.length === 1 ? "team" : "teams"} · sorted by points → goal difference → goals for`,
      "",
      header,
      ...lines,
    ].join("\n");

    const embed = new EmbedBuilder()
      .setColor(0x083696)
      .setTitle(`${competition} · S${season} standings`)
      .setDescription(description.slice(0, 4000))
      .setFooter({ text: "VF League Database · 3 pts win, 1 pt draw" })
      .setTimestamp(new Date());

    await interaction.editReply({ embeds: [embed] });
  } catch (err) {
    console.error("/standings failed:", err);
    await interaction.editReply({
      content: `Could not load standings: ${formatErr(err)}`,
    });
  }
}

/* ------------------------------------------------------------------ */

export const __forTest = {
  buildFixtureNameCandidates,
  normalizeTeamInputForLookup,
};
