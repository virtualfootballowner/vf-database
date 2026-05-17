import { env } from "@/bot/config";

import { formatBailAmountForDisplay } from "@/lib/players/format-ban-bail";

/**
 * Copy for the banned user: pay bail via main server + ticket.
 * (They may use an alt or appeal path depending on league policy.)
 */
export function banBailDmAppendLines(bailAmount: number): string[] {
  if (!Number.isFinite(bailAmount) || bailAmount <= 0) return [];

  const invite = env.DISCORD_LEAGUE_INVITE_URL?.trim();
  const tickets = env.DISCORD_BAIL_TICKET_CHANNEL_URL?.trim();
  const amt = formatBailAmountForDisplay(bailAmount);

  const lines: string[] = [
    "",
    "**Bail**",
    `Staff set bail at **${amt}** (amount is decided by staff; ask in your ticket if unsure).`,
    "To **pay bail** or discuss it: join the **VF League** Discord and **open a support ticket** — staff will walk you through it.",
  ];
  if (invite) lines.push(`**League invite:** ${invite}`);
  if (tickets) lines.push(`**Tickets / appeal:** ${tickets}`);
  if (!invite && !tickets) {
    lines.push(
      "_Use the official league invite from the site or rules, then open a ticket with staff._",
    );
  }
  return lines;
}
