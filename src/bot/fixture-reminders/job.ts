import type { Client } from "discord.js";

import { env } from "@/bot/config";
import {
  buildFixtureReminderEmbed,
  type ManagerFixtureSide,
} from "@/bot/fixture-reminders/messages";
import {
  claimReminderSlot,
  fetchManagerDiscordIdsForSeason,
  fetchScheduledMatchesWithin,
  releaseReminderSlot,
  type ReminderKind,
  type ScheduledMatchReminderRow,
} from "@/bot/fixture-reminders/queries";
import { fetchTeamLogoUrl } from "@/bot/site-assets";
import { createBotSupabase } from "@/bot/stats-queries";

const TICK_MS = 5 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;
const LOOKAHEAD_MS = 25 * HOUR_MS;

/** Send when kickoff is within ±this window of the target offset (24h or 1h). */
const WINDOW_MS = TICK_MS;

function msUntilKickoff(scheduledAt: string): number {
  return new Date(scheduledAt).getTime() - Date.now();
}

function reminderDue(msUntil: number, offsetMs: number): boolean {
  return msUntil <= offsetMs + WINDOW_MS && msUntil >= offsetMs - WINDOW_MS;
}

async function dmManager(
  client: Client,
  discordId: string,
  embed: ReturnType<typeof buildFixtureReminderEmbed>,
): Promise<void> {
  const user = await client.users.fetch(discordId);
  await user.send({ embeds: [embed] });
}

async function sendReminderIfDue(
  client: Client,
  match: ScheduledMatchReminderRow,
  side: ManagerFixtureSide,
  managerDiscordId: string,
  kind: ReminderKind,
  season: number,
): Promise<void> {
  const supabase = createBotSupabase();
  const claimed = await claimReminderSlot(supabase, {
    matchId: match.id,
    managerDiscordId,
    kind,
  });
  if (!claimed) return;

  const siteBase = env.VFL_SITE_URL.replace(/\/$/, "");
  const logoUrl = await fetchTeamLogoUrl(supabase, side.mySlug, siteBase);
  const embed = buildFixtureReminderEmbed({
    match,
    side,
    kind,
    season,
    myLogoUrl: logoUrl,
  });

  try {
    await dmManager(client, managerDiscordId, embed);
    console.log(
      `[fixture-reminder] ${kind} sent to ${managerDiscordId} for match ${match.id.slice(0, 8)}… (${side.mySlug})`,
    );
  } catch (err) {
    await releaseReminderSlot(supabase, {
      matchId: match.id,
      managerDiscordId,
      kind,
    });
    console.error(
      `[fixture-reminder] DM failed ${kind} ${managerDiscordId} match ${match.id}:`,
      err,
    );
  }
}

async function processMatchReminders(
  client: Client,
  match: ScheduledMatchReminderRow,
  managersBySlug: Map<string, string>,
  defaultSeason: number,
): Promise<void> {
  const msUntil = msUntilKickoff(match.scheduled_at);
  if (msUntil <= 0) return;

  const season = match.season ?? defaultSeason;
  const due24 = reminderDue(msUntil, 24 * HOUR_MS);
  const due1 = reminderDue(msUntil, 1 * HOUR_MS);
  if (!due24 && !due1) return;

  const homeManager = managersBySlug.get(match.home_slug);
  const awayManager = managersBySlug.get(match.away_slug);

  if (due24) {
    if (homeManager) {
      await sendReminderIfDue(
        client,
        match,
        {
          mySlug: match.home_slug,
          myName: match.home_name,
          opponentSlug: match.away_slug,
          opponentName: match.away_name,
        },
        homeManager,
        "24h",
        season,
      );
    }
    if (awayManager) {
      await sendReminderIfDue(
        client,
        match,
        {
          mySlug: match.away_slug,
          myName: match.away_name,
          opponentSlug: match.home_slug,
          opponentName: match.home_name,
        },
        awayManager,
        "24h",
        season,
      );
    }
  }

  if (due1) {
    if (homeManager) {
      await sendReminderIfDue(
        client,
        match,
        {
          mySlug: match.home_slug,
          myName: match.home_name,
          opponentSlug: match.away_slug,
          opponentName: match.away_name,
        },
        homeManager,
        "1h",
        season,
      );
    }
    if (awayManager) {
      await sendReminderIfDue(
        client,
        match,
        {
          mySlug: match.away_slug,
          myName: match.away_name,
          opponentSlug: match.home_slug,
          opponentName: match.home_name,
        },
        awayManager,
        "1h",
        season,
      );
    }
  }
}

export async function runFixtureReminderSweep(client: Client): Promise<void> {
  const supabase = createBotSupabase();
  const defaultSeason = env.VF_ACTIVE_ROSTER_SEASON;

  const matches = await fetchScheduledMatchesWithin(supabase, LOOKAHEAD_MS);
  if (matches.length === 0) return;

  const seasons = new Set(
    matches.map((m) => m.season ?? defaultSeason),
  );
  const managersBySeason = new Map<number, Map<string, string>>();
  for (const season of seasons) {
    managersBySeason.set(
      season,
      await fetchManagerDiscordIdsForSeason(supabase, season),
    );
  }

  for (const match of matches) {
    const season = match.season ?? defaultSeason;
    const managersBySlug = managersBySeason.get(season) ?? new Map();
    await processMatchReminders(client, match, managersBySlug, season);
  }

  const dueCount = matches.filter((m) => {
    const ms = msUntilKickoff(m.scheduled_at);
    return reminderDue(ms, 24 * HOUR_MS) || reminderDue(ms, 1 * HOUR_MS);
  }).length;

  if (dueCount > 0) {
    console.log(
      `[fixture-reminder] sweep checked ${matches.length} fixture(s), ${dueCount} in reminder window`,
    );
  }
}

export function scheduleFixtureReminderJob(client: Client): void {
  void runFixtureReminderSweep(client).catch((e) => {
    console.error("[fixture-reminder] initial run:", e);
  });

  setInterval(() => {
    void runFixtureReminderSweep(client).catch((e) => {
      console.error("[fixture-reminder] tick:", e);
    });
  }, TICK_MS);
}
