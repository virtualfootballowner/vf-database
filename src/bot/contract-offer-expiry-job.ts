import type { Client } from "discord.js";
import { EmbedBuilder } from "discord.js";

import { env } from "@/bot/config";
import {
  buildTeamNameBySlug,
  createBotSupabase,
} from "@/bot/stats-queries";
import { fetchTeamLogoUrl } from "@/bot/site-assets";

/** Pending offers older than this are voided (same timing shown on the offer embed). */
const PENDING_OFFER_TTL_MS = 30 * 60 * 1000;

const TICK_MS = 2 * 60 * 1000;

type PendingOfferRow = {
  id: string;
  channel_id: string | null;
  message_id: string | null;
  team_slug: string;
  season: number;
  signee_discord_id: string;
  contractor_discord_id: string;
  roster_position: string;
  roster_role: string;
};

export async function runContractOfferExpirySweep(client: Client): Promise<void> {
  const supabase = createBotSupabase();
  const cutoffIso = new Date(Date.now() - PENDING_OFFER_TTL_MS).toISOString();

  const { data, error } = await supabase
    .from("contract_offers")
    .select(
      "id, channel_id, message_id, team_slug, season, signee_discord_id, contractor_discord_id, roster_position, roster_role",
    )
    .eq("status", "pending")
    .lt("created_at", cutoffIso);

  if (error) {
    console.error("[contract-expiry] fetch:", error);
    return;
  }

  const rows = (data ?? []) as PendingOfferRow[];
  if (rows.length === 0) return;

  const siteBase = env.VFL_SITE_URL.replace(/\/$/, "");

  for (const row of rows) {
    const { data: won, error: upErr } = await supabase
      .from("contract_offers")
      .update({
        status: "expired",
        resolved_at: new Date().toISOString(),
      })
      .eq("id", row.id)
      .eq("status", "pending")
      .select("id")
      .maybeSingle();

    if (upErr) {
      console.error(`[contract-expiry] update ${row.id}:`, upErr);
      continue;
    }
    if (!won) continue;

    if (!row.channel_id || !row.message_id) {
      console.log(
        `[contract-expiry] expired offer ${row.id.slice(0, 8)}… (no Discord message)`,
      );
      continue;
    }

    try {
      const teamNames = await buildTeamNameBySlug(supabase);
      const teamLabel = teamNames.get(row.team_slug) ?? row.team_slug;
      const teamUrl = `${siteBase}/teams/${encodeURIComponent(row.team_slug)}?season=${row.season}`;
      const logoUrl = await fetchTeamLogoUrl(supabase, row.team_slug, siteBase);

      const embed = new EmbedBuilder()
        .setColor(0x78716c)
        .setAuthor({
          name: teamLabel,
          iconURL: logoUrl ?? undefined,
          url: teamUrl,
        })
        .setTitle("Offer void — no response")
        .setDescription(
          [
            `<@${row.signee_discord_id}> did not **approve** or **deny** within **30 minutes**, so this contract offer is **void**.`,
            "",
            "The manager can send a new `/contract` if they still want to sign this player.",
          ].join("\n"),
        )
        .addFields(
          {
            name: "Team",
            value: `[${teamLabel}](${teamUrl})\n\`${row.team_slug}\``,
            inline: false,
          },
          {
            name: "Was offered",
            value: `**${row.roster_position}** · ${row.roster_role}`,
            inline: false,
          },
          {
            name: "Manager",
            value: `<@${row.contractor_discord_id}>`,
            inline: true,
          },
        )
        .setThumbnail(logoUrl ?? null)
        .setFooter({
          text: `Season ${row.season} · Auto-void after 30 min`,
        })
        .setTimestamp(new Date());

      const channel = await client.channels.fetch(row.channel_id);
      if (!channel?.isTextBased()) continue;
      const msg = await channel.messages.fetch(row.message_id);
      await msg.edit({ embeds: [embed], components: [] });
    } catch (e) {
      console.error(
        `[contract-expiry] Discord edit failed for offer ${row.id}:`,
        e,
      );
    }
  }

  if (rows.length > 0) {
    console.log(
      `[contract-expiry] sweep processed ${rows.length} stale pending offer(s)`,
    );
  }
}

export function scheduleContractOfferExpiryJob(client: Client): void {
  void runContractOfferExpirySweep(client).catch((e) => {
    console.error("[contract-expiry] initial run:", e);
  });

  setInterval(() => {
    void runContractOfferExpirySweep(client).catch((e) => {
      console.error("[contract-expiry] tick:", e);
    });
  }, TICK_MS);
}
