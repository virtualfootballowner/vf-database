import { createHmac, timingSafeEqual } from "node:crypto";

export type CreatorSessionPayload = {
  exp: number;
  expectedDiscordId: string;
  codeVerifier?: string;
  applicationId?: string;
  robloxUserId?: string;
  robloxUsername?: string;
  robloxAvatarUrl?: string | null;
  discordUsername?: string;
  discordAvatarUrl?: string | null;
  email?: string | null;
};

export function sealCreatorSession(
  secret: string,
  data: Omit<CreatorSessionPayload, "exp">,
  ttlMs: number,
): string {
  const payload: CreatorSessionPayload = {
    ...data,
    exp: Date.now() + ttlMs,
  };
  const body = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const sig = createHmac("sha256", secret).update(body).digest("base64url");
  return `${body}.${sig}`;
}

export function openCreatorSession(
  secret: string,
  token: string,
): CreatorSessionPayload | null {
  const lastDot = token.lastIndexOf(".");
  if (lastDot <= 0) return null;
  const body = token.slice(0, lastDot);
  const sig = token.slice(lastDot + 1);
  if (!body || !sig) return null;
  const expected = createHmac("sha256", secret).update(body).digest("base64url");
  try {
    const a = Buffer.from(sig, "utf8");
    const b = Buffer.from(expected, "utf8");
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  } catch {
    return null;
  }
  try {
    const parsed = JSON.parse(
      Buffer.from(body, "base64url").toString("utf8"),
    ) as CreatorSessionPayload;
    if (
      typeof parsed.expectedDiscordId !== "string" ||
      typeof parsed.exp !== "number"
    ) {
      return null;
    }
    if (Date.now() > parsed.exp) return null;
    return parsed;
  } catch {
    return null;
  }
}

export const CREATOR_SESSION_COOKIE = "vf_creator_sess";
export const CREATOR_SESSION_TTL_MS = 24 * 60 * 60 * 1000;
