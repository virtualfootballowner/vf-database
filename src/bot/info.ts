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
  memberHasVerifiedAccess,
  verifiedAccessHint,
} from "@/bot/verified-access";
import {
  createBotSupabase,
  loadTeams,
  normalizeTeamInputForLookup,
  resolveTeamForSlashCommand,
  type ResolvedTeam,
  type TeamRow,
} from "@/bot/stats-queries";
import { discordTeamFlag, discordTeamLabel } from "@/bot/discord-team-flags";

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
  if (!memberHasVerifiedAccess(member)) {
    await interaction.reply({
      flags: MessageFlags.Ephemeral,
      content: verifiedAccessHint(interaction.guild.id),
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
          "**`/fixtures`** — next matchweek slate, or last 5 + next 5 for a club/nation",
          "**`/standings`** — league table for a competition + season",
        ].join("\n"),
        inline: false,
      },
      {
        name: "👤 Players · marketplace",
        value: [
          "**`/freeagent`** — post yourself (broad role + optional extra positions) · *6h cooldown*",
        ].join("\n"),
        inline: false,
      },
      {
        name: `🏟️ Club managers · ${managerRole}`,
        value: [
          "**`/contract`** — offer a roster contract (player accepts, then staff approve before roster update)",
          "**`/release`** — request to release a player from your roster (Discord member or Roblox username if they left)",
          "**`/postpone`** — request to move your next fixture (pick timezone + proposed date/time; no response in 24h counts as a denial; staff after 2 denials)",
          "**`/friendly`** — post a friendly request in the finder",
          "**`/scouting`** — post a custom scouting message (optional role filter)",
        ].join("\n"),
        inline: false,
      },
      {
        name: "🛠️ Staff · server managers",
        value: [
          "**`/postverify`** — post the verify card in this channel",
          "**`/postverify-media`** — VF Media nickname + verified role card",
          "**`/postverify-media-staff`** — VF Media staff verify + application card",
          "**`/help`** — post this command index in this channel",
          "**`/appoint`** — assign a club / nation manager for a season",
          "**`/backlog`** — all pending staff approvals (whitelist, VF Create, media, releases, contract signings)",
          "**`/postpone-log`** — postponement requests for upcoming fixtures (timing and denial history)",
          "**`/results`** — log a fixture result (match ID, score, scorers, cards, MOTM) and post to #results",
          "**`/creator-remove`** — delete all VF Create DB rows for a user + strip creator role",
          "**`/kick`** · **`/ban`** — moderation (VF ban blocks profile, scrimmages, and league access)",
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
/*  /fixtures [team] — matchweek slate or club results + fixtures     */
/* ------------------------------------------------------------------ */

type ResolvedTeamWithId = ResolvedTeam & { id: string };

type ScheduledMatchRow = {
  id: string;
  roblox_match_id: string | null;
  season: number | null;
  competition: string | null;
  stage: string;
  match_week: number | null;
  game_week_label: string | null;
  scheduled_at: string;
  home_team_id: string;
  away_team_id: string;
  match_notes: string | null;
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

function parseStadium(notes: string | null): string {
  if (!notes?.trim()) return "TBD";
  const hit = notes.match(/Stadium:\s*(.+)/i);
  return hit?.[1]?.trim() || "TBD";
}

function discordWhen(iso: string | null | undefined): string {
  if (!iso) return "Time TBD";
  const ms = new Date(iso).getTime();
  if (Number.isNaN(ms)) return "Time TBD";
  const ts = Math.floor(ms / 1000);
  return `<t:${ts}:f> · <t:${ts}:R>`;
}

/** Blank line between fixture rows in Discord embeds. */
const FIXTURE_ENTRY_GAP = "\n\n";

function joinFixtureEntries(lines: string[]): string {
  return lines.join(FIXTURE_ENTRY_GAP);
}

/** Split embed field text on fixture boundaries — never mid-line / mid-timestamp. */
function chunkFixtureEmbedField(text: string, max = 1024): string[] {
  if (text.length <= max) return [text];

  const entries = text.split(FIXTURE_ENTRY_GAP);
  const chunks: string[] = [];
  let current = "";

  for (const entry of entries) {
    if (!entry.trim()) continue;
    const next = current.length === 0 ? entry : `${current}${FIXTURE_ENTRY_GAP}${entry}`;
    if (next.length <= max) {
      current = next;
      continue;
    }
    if (current.length > 0) {
      chunks.push(current);
      current = entry;
      continue;
    }
    // Single fixture longer than max (shouldn't happen) — keep intact, Discord truncates.
    chunks.push(entry.slice(0, max));
    current = "";
  }

  if (current.length > 0) chunks.push(current);
  return chunks.length > 0 ? chunks : [text.slice(0, max)];
}

function trimEmbedField(text: string, max = 1024): string {
  if (text.length <= max) return text;
  const [first] = chunkFixtureEmbedField(text, max);
  return first ?? text.slice(0, max);
}

function matchweekKey(m: ScheduledMatchRow): string {
  const gw = m.game_week_label?.trim();
  if (gw && gw !== "—") {
    return `${m.season ?? 0}|${m.competition ?? ""}|${gw}`;
  }
  if (m.match_week != null) {
    return `${m.season ?? 0}|${m.competition ?? ""}|mw:${m.match_week}`;
  }
  const day = m.scheduled_at?.slice(0, 10) ?? "unknown";
  return `${m.season ?? 0}|${m.competition ?? ""}|d:${day}`;
}

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

type TeamMeta = { name: string; slug: string | null };

async function loadTeamMetaById(
  supabase: SupabaseClient,
  ids: string[],
): Promise<Map<string, TeamMeta>> {
  const map = new Map<string, TeamMeta>();
  const unique = [...new Set(ids.filter(Boolean))];
  if (unique.length === 0) return map;
  const { data, error } = await supabase
    .from("teams")
    .select("id, name, slug")
    .in("id", unique);
  if (error) throw error;
  for (const r of (data ?? []) as {
    id: string;
    name: string;
    slug: string | null;
  }[]) {
    map.set(r.id, { name: r.name, slug: r.slug?.trim() || null });
  }
  return map;
}

async function fetchGroupCodesByRobloxId(
  supabase: SupabaseClient,
  robloxIds: string[],
): Promise<Map<string, string | null>> {
  const map = new Map<string, string | null>();
  const codes = [...new Set(robloxIds.filter(Boolean))];
  if (codes.length === 0) return map;
  const { data, error } = await supabase
    .from("fixtures")
    .select("roblox_match_id, group_code")
    .in("roblox_match_id", codes);
  if (error) throw error;
  for (const r of (data ?? []) as {
    roblox_match_id: string | null;
    group_code: string | null;
  }[]) {
    if (r.roblox_match_id) map.set(r.roblox_match_id, r.group_code);
  }
  return map;
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
  push(team.slug.replace(/-/g, " "));
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

async function fetchScheduledMatches(
  supabase: SupabaseClient,
): Promise<ScheduledMatchRow[]> {
  const { data, error } = await supabase
    .from("matches")
    .select(
      "id, roblox_match_id, season, competition, stage, match_week, game_week_label, scheduled_at, home_team_id, away_team_id, match_notes",
    )
    .eq("status", "scheduled")
    .order("scheduled_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as ScheduledMatchRow[];
}

async function fetchUpcomingScheduledForTeam(
  supabase: SupabaseClient,
  teamId: string,
  limit = 5,
): Promise<ScheduledMatchRow[]> {
  const { data, error } = await supabase
    .from("matches")
    .select(
      "id, roblox_match_id, season, competition, stage, match_week, game_week_label, scheduled_at, home_team_id, away_team_id, match_notes",
    )
    .or(`home_team_id.eq.${teamId},away_team_id.eq.${teamId}`)
    .eq("status", "scheduled")
    .order("scheduled_at", { ascending: true })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as ScheduledMatchRow[];
}

async function fetchUnlinkedFixturesForTeam(
  supabase: SupabaseClient,
  team: ResolvedTeamWithId,
): Promise<UpcomingFixtureRow[]> {
  const candidates = buildFixtureNameCandidates(team)
    .map((c) => c.replace(/[,()*%]/g, "").trim())
    .filter((c) => c.length >= 3);
  if (candidates.length === 0) return [];
  const orClauses = candidates
    .flatMap((c) => [
      `home_team_name.ilike.%${c}%`,
      `away_team_name.ilike.%${c}%`,
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

async function fetchNextMatchweekBundle(
  supabase: SupabaseClient,
): Promise<{ label: string; competition: string; season: number; matches: ScheduledMatchRow[] } | null> {
  const scheduled = await fetchScheduledMatches(supabase);
  if (scheduled.length === 0) return null;

  const first = scheduled[0]!;
  const key = matchweekKey(first);
  const bucket = scheduled.filter((m) => matchweekKey(m) === key);
  const label =
    first.game_week_label?.trim() ||
    (first.match_week != null ? `Matchweek ${first.match_week}` : "Next fixtures");

  return {
    label,
    competition: first.competition?.trim() || "—",
    season: first.season ?? 0,
    matches: bucket,
  };
}

function stageLabelForMatch(
  m: ScheduledMatchRow,
  groupByRoblox: Map<string, string | null>,
): string {
  if (m.stage === "Group") {
    const g = m.roblox_match_id
      ? groupByRoblox.get(m.roblox_match_id)
      : null;
    return g ? `Group ${g}` : "Group";
  }
  return m.stage?.trim() || "Fixture";
}

function renderPastMatches(
  rows: PastMatchRow[],
  team: ResolvedTeamWithId,
  idToMeta: Map<string, TeamMeta>,
): string {
  if (rows.length === 0) {
    return "*No completed matches on file yet.*";
  }
  const lines = rows.map((m) => {
      const isHome = m.home_team_id === team.id;
      const oppId = isHome ? m.away_team_id : m.home_team_id;
      const opp = idToMeta.get(oppId);
      const oppLabel = discordTeamLabel(opp?.name ?? "Unknown", opp?.slug);
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
      return `${result}  **${score}**  ${venue} ${oppLabel} · ${compTag}S${m.season ?? "?"} ${ts}`;
    });
  return joinFixtureEntries(lines);
}

function renderUpcomingForTeam(
  scheduled: ScheduledMatchRow[],
  legacy: UpcomingFixtureRow[],
  team: ResolvedTeamWithId,
  idToMeta: Map<string, TeamMeta>,
  groupByRoblox: Map<string, string | null>,
): string {
  if (scheduled.length > 0) {
    return joinFixtureEntries(
      scheduled.map((m) => {
        const home = idToMeta.get(m.home_team_id);
        const away = idToMeta.get(m.away_team_id);
        const comp =
          m.competition && m.competition !== "—"
            ? `\`${m.competition}\` · `
            : "";
        const stage = stageLabelForMatch(m, groupByRoblox);
        return `${discordTeamLabel(home?.name ?? "TBD", home?.slug)} vs ${discordTeamLabel(away?.name ?? "TBD", away?.slug)} · ${comp}${stage} · ${discordWhen(m.scheduled_at)} · 📍 ${parseStadium(m.match_notes)}`;
      }),
    );
  }

  if (legacy.length === 0) {
    return "*No upcoming fixtures scheduled — once the draw / next slate is set, they'll appear here.*";
  }

  return joinFixtureEntries(
    legacy.map((f) => {
      const candidates = buildFixtureNameCandidates(team).map((c) =>
        c.toLowerCase(),
      );
      const home = f.home_team_name?.trim() ?? "";
      const away = f.away_team_name?.trim() ?? "";
      const isHome = candidates.some((c) => home.toLowerCase().includes(c));
      const oppRaw = isHome ? away : home;
      const selfRaw = isHome ? home : away;
      const seedFallback = (() => {
        const meta = f.metadata ?? {};
        const homeSeed = (meta as { home_seed?: string }).home_seed;
        const awaySeed = (meta as { away_seed?: string }).away_seed;
        if (isHome && awaySeed) return `slot ${awaySeed}`;
        if (!isHome && homeSeed) return `slot ${homeSeed}`;
        return "TBD";
      })();
      const opp = oppRaw.length > 0 ? oppRaw : seedFallback;
      const self = selfRaw.length > 0 ? selfRaw : team.name;
      const stage =
        f.stage === "Group" && f.group_code
          ? `Group ${f.group_code}`
          : f.stage;
      const meta = f.metadata ?? {};
      const scheduledAt =
        typeof meta.scheduled_at === "string" ? meta.scheduled_at : null;
      const stadium =
        typeof meta.stadium === "string" ? meta.stadium.trim() : "TBD";
      const when = scheduledAt ? discordWhen(scheduledAt) : "Time TBD";
      return `${discordTeamLabel(self)} vs ${discordTeamLabel(opp)} · \`${f.competition}\` · ${stage} · ${when} · 📍 ${stadium || "TBD"}`;
    }),
  );
}

function renderMatchweekFixtures(
  rows: ScheduledMatchRow[],
  idToMeta: Map<string, TeamMeta>,
  groupByRoblox: Map<string, string | null>,
): string {
  if (rows.length === 0) {
    return "*No upcoming fixtures are scheduled yet.*";
  }
  return joinFixtureEntries(
    rows.map((m) => {
      const home = idToMeta.get(m.home_team_id);
      const away = idToMeta.get(m.away_team_id);
      const comp =
        m.competition && m.competition !== "—"
          ? `\`${m.competition}\` · `
          : "";
      const stage = stageLabelForMatch(m, groupByRoblox);
      return `${discordTeamLabel(home?.name ?? "TBD", home?.slug)} vs ${discordTeamLabel(away?.name ?? "TBD", away?.slug)} · ${comp}${stage} · ${discordWhen(m.scheduled_at)} · 📍 ${parseStadium(m.match_notes)}`;
    }),
  );
}

async function replyNextMatchweek(
  interaction: ChatInputCommandInteraction,
  supabase: SupabaseClient,
): Promise<void> {
  const bundle = await fetchNextMatchweekBundle(supabase);
  if (!bundle || bundle.matches.length === 0) {
    await interaction.editReply({
      content:
        "No upcoming fixtures are scheduled yet. Check back once the next matchweek is on the calendar.",
    });
    return;
  }

  const teamIds = bundle.matches.flatMap((m) => [m.home_team_id, m.away_team_id]);
  const robloxIds = bundle.matches
    .map((m) => m.roblox_match_id)
    .filter((id): id is string => Boolean(id));
  const [idToMeta, groupByRoblox] = await Promise.all([
    loadTeamMetaById(supabase, teamIds),
    fetchGroupCodesByRobloxId(supabase, robloxIds),
  ]);

  const body = renderMatchweekFixtures(
    bundle.matches,
    idToMeta,
    groupByRoblox,
  );
  const siteBase = env.VFL_SITE_URL.replace(/\/$/, "");
  const fixturesUrl = `${siteBase}/tournament`;

  const embed = new EmbedBuilder()
    .setColor(0x083696)
    .setTitle(`${bundle.label} · fixtures`)
    .setDescription(
      [
        `All **${bundle.matches.length}** scheduled fixtures for the next matchweek — **${bundle.competition}** · Season ${bundle.season}.`,
        `[Full schedule on the site](${fixturesUrl})`,
      ].join("\n"),
    )
    .setFooter({ text: "VF League Database · Times shown in your Discord timezone" })
    .setTimestamp(new Date());

  const chunks = chunkFixtureEmbedField(body);
  chunks.forEach((chunk, i) => {
    embed.addFields({
      name: i === 0 ? "📅 Fixtures" : `📅 Fixtures (cont. ${i + 1})`,
      value: chunk,
      inline: false,
    });
  });

  await interaction.editReply({ embeds: [embed] });
}

export async function handleFixtures(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  if (!(await requireVerifiedRole(interaction))) return;
  const teamRaw = interaction.options.getString("team");
  await interaction.deferReply();

  try {
    const supabase = createBotSupabase();

    if (!teamRaw?.trim()) {
      await replyNextMatchweek(interaction, supabase);
      return;
    }

    const teamRows = await loadTeams(supabase);
    const team = await resolveTeamWithId(supabase, teamRows, teamRaw);
    if (!team) {
      await interaction.editReply({
        content:
          "Could not resolve that club. Use the **team** autocomplete or the exact slug (e.g. `andover-fc`).",
      });
      return;
    }

    const [past, upcomingScheduled, upcomingLegacy] = await Promise.all([
      fetchPastMatchesForTeam(supabase, team.id),
      fetchUpcomingScheduledForTeam(supabase, team.id),
      fetchUnlinkedFixturesForTeam(supabase, team),
    ]);

    const opponentIds = [
      ...new Set(
        past.map((m) =>
          m.home_team_id === team.id ? m.away_team_id : m.home_team_id,
        ),
      ),
    ];
    const upcomingTeamIds = upcomingScheduled.flatMap((m) => [
      m.home_team_id,
      m.away_team_id,
    ]);
    const [idToMeta, groupByRoblox] = await Promise.all([
      loadTeamMetaById(supabase, [...opponentIds, ...upcomingTeamIds, team.id]),
      fetchGroupCodesByRobloxId(
        supabase,
        upcomingScheduled
          .map((m) => m.roblox_match_id)
          .filter((id): id is string => Boolean(id)),
      ),
    ]);

    const siteBase = env.VFL_SITE_URL.replace(/\/$/, "");
    const teamUrl = `${siteBase}/teams/${encodeURIComponent(team.slug)}`;
    const dbLogo = await fetchTeamLogoUrl(supabase, team.slug, siteBase);
    const logoUrl =
      dbLogo ?? absoluteSiteAssetUrl(team.logo_url ?? null, siteBase);

    const teamFlag = discordTeamFlag(team.slug);
    const embed = new EmbedBuilder()
      .setColor(0x083696)
      .setAuthor({
        name: `${teamFlag ? `${teamFlag} ` : ""}${team.name} · VF League`,
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
          value: trimEmbedField(renderPastMatches(past, team, idToMeta)),
          inline: false,
        },
        {
          name: "📅 Next 5 fixtures",
          value: trimEmbedField(
            renderUpcomingForTeam(
              upcomingScheduled,
              upcomingLegacy,
              team,
              idToMeta,
              groupByRoblox,
            ),
          ),
          inline: false,
        },
      )
      .setFooter({ text: "VF League Database · Times shown in your Discord timezone" })
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
