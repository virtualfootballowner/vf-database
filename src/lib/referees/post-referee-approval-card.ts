import {
  REFEREE_APPROVE_PREFIX,
  REFEREE_DENY_PREFIX,
} from "@/lib/referees/discord-constants";

const DISCORD_API = "https://discord.com/api/v10";

export async function postRefereeApprovalCardViaDiscordApi(opts: {
  botToken: string;
  channelId: string;
  discordId: string;
  discordUsername: string;
  robloxUsername: string;
  robloxUserId: string;
  headshotUrl?: string | null;
}): Promise<{ ok: true } | { ok: false; detail: string }> {
  const robloxField = `[${opts.robloxUsername}](https://www.roblox.com/users/${opts.robloxUserId}/profile)`;

  const embed: Record<string, unknown> = {
    title: "Referee verification",
    description:
      "Applicant completed Discord + Roblox verify. Nickname should match Roblox username.",
    color: 0xf59e0b,
    fields: [
      {
        name: "Discord",
        value: `<@${opts.discordId}> (${opts.discordUsername})`,
        inline: false,
      },
      {
        name: "Roblox",
        value: `${robloxField}\n\`${opts.robloxUserId}\``,
        inline: false,
      },
    ],
    footer: { text: "VF Referees · Staff: Approve or Deny" },
    timestamp: new Date().toISOString(),
  };

  if (opts.headshotUrl) {
    embed.thumbnail = { url: opts.headshotUrl };
  }

  const components = [
    {
      type: 1,
      components: [
        {
          type: 2,
          style: 3,
          label: "Approve",
          custom_id: `${REFEREE_APPROVE_PREFIX}${opts.discordId}`,
        },
        {
          type: 2,
          style: 4,
          label: "Deny",
          custom_id: `${REFEREE_DENY_PREFIX}${opts.discordId}`,
        },
      ],
    },
  ];

  const res = await fetch(
    `${DISCORD_API}/channels/${opts.channelId}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bot ${opts.botToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        embeds: [embed],
        components,
      }),
    },
  );

  if (!res.ok) {
    const t = await res.text().catch(() => "");
    return {
      ok: false,
      detail: `${res.status} ${res.statusText} ${t.slice(0, 300)}`,
    };
  }

  return { ok: true };
}
