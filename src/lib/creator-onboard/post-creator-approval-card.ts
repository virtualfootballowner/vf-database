import {
  CREATOR_APPROVE_PREFIX,
  CREATOR_REJECT_PREFIX,
} from "@/lib/creator-onboard/creator-discord-constants";
import { formatCreatorPlayPlatform } from "@/lib/creator-onboard/play-platform";
import {
  socialProfileLabel,
  tiktokProfileHref,
  youtubeProfileHref,
} from "@/lib/creator-onboard/validators";

const DISCORD_API = "https://discord.com/api/v10";

function staffDiscordSocialField(
  href: string | null,
  displayHandle: string | null,
  product: "TikTok" | "YouTube",
): string {
  if (!href) return "—";
  // Use a Markdown-safe link label — underscores in @handles break Discord's
  // [text](url) parser (italic / malformed links → wrong click targets / 404s).
  const hint =
    displayHandle && displayHandle !== "—"
      ? `\n\`${displayHandle}\``
      : "";
  return `[Open ${product} profile](${href})${hint}`;
}

function redactEmail(email: string | null | undefined): string {
  if (!email || !email.includes("@")) return "—";
  const [a, dom] = email.split("@");
  const safe =
    a.length <= 2 ? `${a[0] ?? ""}***` : `${a.slice(0, 2)}***`;
  return `${safe}@${dom}`;
}

/** Post the staff review embed + Approve/Reject buttons (Discord REST, same pattern as /verify). */
export async function postCreatorApprovalCardViaDiscordApi(opts: {
  botToken: string;
  channelId: string;
  applicationId: string;
  row: Record<string, unknown>;
}): Promise<{ ok: true } | { ok: false; detail: string }> {
  const r = opts.row;
  const discordId = String(r.discord_id ?? "");
  const discordUser = String(r.discord_username ?? "unknown");
  const robloxUser = String(r.roblox_username ?? "");
  const robloxIdRaw = String(r.roblox_id ?? "");
  // Drafts created while Roblox OAuth is pending approval use a
  // `pending-{discordId}` placeholder; don't expose that to staff.
  const robloxIsManual = robloxIdRaw.startsWith("pending-");
  const robloxIdLine = robloxIsManual
    ? "_manual entry — Roblox OAuth pending approval_"
    : `\`${robloxIdRaw}\``;
  const age = r.age != null ? String(r.age) : "—";
  const country = String(r.country ?? "—");
  const platformLabel = formatCreatorPlayPlatform(
    typeof r.play_platform === "string" ? r.play_platform : null,
  );
  const platform = platformLabel ?? "—";
  const tiktokRaw = typeof r.tiktok_handle === "string" ? r.tiktok_handle : null;
  const youtubeRaw =
    typeof r.youtube_handle === "string" ? r.youtube_handle : null;
  const tt = staffDiscordSocialField(
    tiktokProfileHref(tiktokRaw),
    socialProfileLabel(tiktokRaw),
    "TikTok",
  );
  const yt = staffDiscordSocialField(
    youtubeProfileHref(youtubeRaw),
    socialProfileLabel(youtubeRaw),
    "YouTube",
  );

  const embed = {
    title: "New creator application",
    description: `Application ID: \`${opts.applicationId}\``,
    color: 0xf59e0b,
    fields: [
      {
        name: "Discord",
        value: `${discordUser}\n\`${discordId}\``,
        inline: false,
      },
      {
        name: "Roblox",
        value: `${robloxUser}\n${robloxIdLine}`,
        inline: false,
      },
      {
        name: "Age / country / platform",
        value: `${age} · ${country} · ${platform}`,
        inline: true,
      },
      {
        name: "TikTok",
        value: tt,
        inline: true,
      },
      {
        name: "YouTube",
        value: yt,
        inline: true,
      },
      {
        name: "Email",
        value: redactEmail(typeof r.email === "string" ? r.email : null),
        inline: false,
      },
    ],
    footer: { text: "Pending review" },
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
          custom_id: `${CREATOR_APPROVE_PREFIX}${opts.applicationId}`,
        },
        {
          type: 2,
          style: 4,
          label: "Reject",
          custom_id: `${CREATOR_REJECT_PREFIX}${opts.applicationId}`,
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
