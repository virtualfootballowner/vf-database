import { createHmac, timingSafeEqual } from "node:crypto";

export type VerifySessionPayload = {
  discordUserId: string;
  codeVerifier: string;
  exp: number;
};

export function sealVerifySession(
  secret: string,
  data: Omit<VerifySessionPayload, "exp">,
  ttlMs: number,
): string {
  const payload: VerifySessionPayload = {
    ...data,
    exp: Date.now() + ttlMs,
  };
  const body = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const sig = createHmac("sha256", secret).update(body).digest("base64url");
  return `${body}.${sig}`;
}

export function openVerifySession(
  secret: string,
  token: string,
): VerifySessionPayload | null {
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
    ) as VerifySessionPayload;
    if (
      typeof parsed.discordUserId !== "string" ||
      typeof parsed.codeVerifier !== "string" ||
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
