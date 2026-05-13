import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";

import {
  MEDIA_STAFF_APP_COOKIE,
  openMediaStaffApp,
} from "@/lib/media-staff/media-staff-session";
import {
  fetchDiscordUserDisplay,
  postMediaStaffApplicationCard,
} from "@/lib/media-staff/post-media-staff-application";
import {
  mediaStaffRoleKeySchema,
  mediaStaffRoleLabel,
} from "@/lib/media-staff/media-staff-roles";
import { loadMediaVerifyEnv } from "@/lib/vfl-verify/load-media-verify-env";

export const dynamic = "force-dynamic";

const MAX_FILE_BYTES = 8 * 1024 * 1024;
const ALLOWED_MIME = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
  "application/zip",
]);

const fieldSchema = z
  .object({
    role: mediaStaffRoleKeySchema,
    experience_link: z.string().max(2000).optional(),
    other_detail: z.string().max(500).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.role === "other") {
      const t = data.other_detail?.trim() ?? "";
      if (t.length < 2) {
        ctx.addIssue({
          code: "custom",
          message: "Please briefly describe your role.",
          path: ["other_detail"],
        });
      }
    }
  });

export async function POST(request: Request) {
  let env;
  try {
    env = loadMediaVerifyEnv();
  } catch {
    return NextResponse.json(
      { error: "Media verification is not configured." },
      { status: 503 },
    );
  }

  const channelId = process.env.DISCORD_CREATOR_APPROVAL_CHANNEL_ID?.trim();
  if (!channelId) {
    return NextResponse.json(
      { error: "Staff approval channel is not configured." },
      { status: 503 },
    );
  }

  const cookieStore = await cookies();
  const sealed = cookieStore.get(MEDIA_STAFF_APP_COOKIE)?.value ?? null;
  if (!sealed) {
    return NextResponse.json(
      { error: "Session expired. Verify again from the start." },
      { status: 401 },
    );
  }

  const session = openMediaStaffApp(env.VERIFY_COOKIE_SECRET, sealed);
  if (!session) {
    return NextResponse.json(
      { error: "Session expired. Verify again from the start." },
      { status: 401 },
    );
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data." }, { status: 400 });
  }

  const roleRaw = form.get("role");
  const linkRaw = form.get("experience_link");
  const otherRaw = form.get("other_detail");
  const fileEntry = form.get("portfolio");

  const parsed = fieldSchema.safeParse({
    role: typeof roleRaw === "string" ? roleRaw : "",
    experience_link: typeof linkRaw === "string" ? linkRaw : "",
    other_detail: typeof otherRaw === "string" ? otherRaw : "",
  });

  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message ?? "Invalid fields.";
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  let experienceLink = parsed.data.experience_link?.trim() ?? "";
  if (experienceLink.length > 0) {
    try {
      const u = new URL(experienceLink);
      if (u.protocol !== "https:" && u.protocol !== "http:") {
        return NextResponse.json(
          { error: "Experience link must be http(s)." },
          { status: 400 },
        );
      }
    } catch {
      return NextResponse.json(
        { error: "Experience link must be a valid URL." },
        { status: 400 },
      );
    }
  } else {
    experienceLink = "";
  }

  let filePart: { name: string; type: string; buffer: Buffer } | null = null;
  if (fileEntry instanceof File && fileEntry.size > 0) {
    if (fileEntry.size > MAX_FILE_BYTES) {
      return NextResponse.json(
        { error: "File must be 8 MB or smaller." },
        { status: 400 },
      );
    }
    const mime = fileEntry.type || "application/octet-stream";
    if (!ALLOWED_MIME.has(mime)) {
      return NextResponse.json(
        {
          error: "Allowed file types: PDF, PNG, JPEG, WebP, or ZIP.",
        },
        { status: 400 },
      );
    }
    const buf = Buffer.from(await fileEntry.arrayBuffer());
    filePart = {
      name: fileEntry.name.slice(0, 80) || "portfolio",
      type: mime,
      buffer: buf,
    };
  }

  if (!experienceLink && !filePart) {
    return NextResponse.json(
      {
        error: "Add a link to your work or upload a sample file (or both).",
      },
      { status: 400 },
    );
  }

  const discordUser = await fetchDiscordUserDisplay(
    env.DISCORD_BOT_TOKEN,
    session.discordUserId,
  );
  const discordUsername =
    discordUser?.global_name?.trim() ||
    discordUser?.username ||
    session.discordUserId;

  const otherNote =
    parsed.data.role === "other"
      ? (parsed.data.other_detail?.trim() ?? null)
      : null;

  const posted = await postMediaStaffApplicationCard({
    botToken: env.DISCORD_BOT_TOKEN,
    channelId,
    discordUserId: session.discordUserId,
    discordUsername,
    robloxUserId: session.robloxUserId,
    robloxUsername: session.robloxUsername,
    roleLabel: mediaStaffRoleLabel(parsed.data.role),
    otherDetail: otherNote,
    experienceLink: experienceLink.length > 0 ? experienceLink : null,
    file: filePart,
  });

  if (!posted.ok) {
    console.error("[media-staff] Discord post failed:", posted.detail);
    return NextResponse.json(
      { error: "Could not reach Discord. Try again later." },
      { status: 502 },
    );
  }

  const res = NextResponse.json({ ok: true });
  const secure = process.env.NODE_ENV === "production";
  res.cookies.set(MEDIA_STAFF_APP_COOKIE, "", {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return res;
}
