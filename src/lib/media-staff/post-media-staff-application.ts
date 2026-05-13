import {
  MEDIA_STAFF_APPROVE_PREFIX,
  MEDIA_STAFF_REJECT_PREFIX,
} from "@/lib/media-staff/media-discord-constants";

const DISCORD_API = "https://discord.com/api/v10";

export async function postMediaStaffApplicationCard(opts: {
  botToken: string;
  channelId: string;
  discordUserId: string;
  discordUsername: string;
  robloxUserId: string;
  robloxUsername: string;
  roleLabel: string;
  /** Free text if "other" or extra notes — optional */
  otherDetail: string | null;
  experienceLink: string | null;
  file?: { name: string; type: string; buffer: Buffer } | null;
}): Promise<{ ok: true } | { ok: false; detail: string }> {
  const expLines: string[] = [];
  if (opts.experienceLink?.trim()) {
    expLines.push(opts.experienceLink.trim());
  }
  if (opts.file) {
    expLines.push("_Portfolio file attached below._");
  }
  if (opts.otherDetail?.trim()) {
    expLines.push(`_Note:_ ${opts.otherDetail.trim().slice(0, 900)}`);
  }
  const experience =
    expLines.length > 0 ? expLines.join("\n\n") : "_No link or file provided._";

  const embed = {
    title: "New media staff application",
    description: `Applicant: <@${opts.discordUserId}>`,
    color: 0x6366f1,
    fields: [
      {
        name: "Discord",
        value: `${opts.discordUsername}\n\`${opts.discordUserId}\``,
        inline: false,
      },
      {
        name: "Roblox",
        value: `${opts.robloxUsername}\n\`${opts.robloxUserId}\``,
        inline: false,
      },
      {
        name: "Role",
        value: opts.roleLabel,
        inline: true,
      },
      {
        name: "Experience / samples",
        value: experience.slice(0, 1024),
        inline: false,
      },
    ],
    footer: { text: "Pending review · Media staff" },
    timestamp: new Date().toISOString(),
  };

  const components = [
    {
      type: 1,
      components: [
        {
          type: 2,
          style: 3,
          label: "Approve",
          custom_id: `${MEDIA_STAFF_APPROVE_PREFIX}${opts.discordUserId}`,
        },
        {
          type: 2,
          style: 4,
          label: "Reject",
          custom_id: `${MEDIA_STAFF_REJECT_PREFIX}${opts.discordUserId}`,
        },
      ],
    },
  ];

  const payload = { embeds: [embed], components };

  if (opts.file && opts.file.buffer.byteLength > 0) {
    const form = new FormData();
    form.append("payload_json", JSON.stringify(payload));
    const blob = new Blob([new Uint8Array(opts.file.buffer)], {
      type: opts.file.type,
    });
    form.append("files[0]", blob, opts.file.name);

    const res = await fetch(
      `${DISCORD_API}/channels/${opts.channelId}/messages`,
      {
        method: "POST",
        headers: { Authorization: `Bot ${opts.botToken}` },
        body: form,
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

  const res = await fetch(
    `${DISCORD_API}/channels/${opts.channelId}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bot ${opts.botToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
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

/** Discord REST: GET user (for display name on staff card). */
export async function fetchDiscordUserDisplay(
  botToken: string,
  userId: string,
): Promise<{ username: string; global_name: string | null } | null> {
  const res = await fetch(`${DISCORD_API}/users/${userId}`, {
    headers: { Authorization: `Bot ${botToken}` },
  });
  if (!res.ok) return null;
  const j = (await res.json()) as {
    username?: string;
    global_name?: string | null;
  };
  if (typeof j.username !== "string") return null;
  return {
    username: j.username,
    global_name: typeof j.global_name === "string" ? j.global_name : null,
  };
}
