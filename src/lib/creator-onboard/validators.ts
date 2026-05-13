/** Snowflake-style Discord user id (string of digits). */
export function isDiscordUserId(value: string): boolean {
  return /^\d{17,20}$/.test(value.trim());
}

export function stripAtHandle(raw: string | undefined | null): string | null {
  if (raw == null) return null;
  const t = raw.trim().replace(/^@+/, "");
  return t.length > 0 ? t : null;
}

/** Remove Markdown escape backslashes often introduced by copy-paste (e.g. `mr\_gg\_neuer`). */
function scrubMarkdownEscapesInSocialPaste(raw: string): string {
  return raw.replace(/\\([\\_*[\]()~`#+\-.!|>])/g, "$1");
}

/**
 * Try to parse an http(s) URL. Returns the URL object on success, or null.
 * Accepts inputs that omit the scheme (e.g. `www.tiktok.com/@foo`) and adds
 * `https://` before parsing.
 */
function tryParseHttpUrl(raw: string): URL | null {
  const t = raw.trim();
  if (!t) return null;
  let candidate = t;
  if (!/^https?:\/\//i.test(candidate)) {
    candidate = `https://${candidate.replace(/^\/+/, "")}`;
  }
  try {
    const u = new URL(candidate);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    return u;
  } catch {
    return null;
  }
}

/**
 * Accept either a full TikTok profile URL OR a bare `@handle` / `handle` and
 * return a canonical `https://www.tiktok.com/@handle` (or a clean
 * `https://www.tiktok.com/...` profile URL). Returns null if the value can't
 * be coerced into a TikTok profile URL.
 */
export function normalizeTiktokProfileUrl(
  raw: string | undefined | null,
): string | null {
  if (raw == null) return null;
  const t = scrubMarkdownEscapesInSocialPaste(raw.trim());
  if (!t) return null;

  if (t.startsWith("@") || /^[A-Za-z0-9._]+$/.test(t)) {
    const handle = t.replace(/^@+/, "");
    if (!handle || !/^[A-Za-z0-9._]{1,30}$/.test(handle)) return null;
    return `https://www.tiktok.com/@${handle}`;
  }

  const u = tryParseHttpUrl(t);
  if (!u) return null;
  const host = u.hostname.toLowerCase().replace(/^www\./, "");
  if (host !== "tiktok.com" && !host.endsWith(".tiktok.com")) return null;
  const path = u.pathname.replace(/\/+$/, "");
  if (!path || path === "/") return null;
  // Preserve the original host (covers vm.tiktok.com short links etc.).
  return `https://${u.hostname.toLowerCase()}${path}`;
}

/**
 * Accept either a full YouTube profile/channel URL OR a bare `@handle` /
 * `handle` and return a canonical `https://www.youtube.com/...`. Returns null
 * if the value can't be coerced into a YouTube profile URL.
 */
export function normalizeYoutubeProfileUrl(
  raw: string | undefined | null,
): string | null {
  if (raw == null) return null;
  const t = scrubMarkdownEscapesInSocialPaste(raw.trim());
  if (!t) return null;

  if (t.startsWith("@") || /^[A-Za-z0-9._-]+$/.test(t)) {
    const handle = t.replace(/^@+/, "");
    if (!handle || !/^[A-Za-z0-9._-]{1,60}$/.test(handle)) return null;
    return `https://www.youtube.com/@${handle}`;
  }

  const u = tryParseHttpUrl(t);
  if (!u) return null;
  const host = u.hostname.toLowerCase().replace(/^www\./, "");
  const isYoutube =
    host === "youtube.com" ||
    host.endsWith(".youtube.com") ||
    host === "youtu.be";
  if (!isYoutube) return null;
  const path = u.pathname.replace(/\/+$/, "");
  if (!path || path === "/") return null;
  // For canonical youtube.com paths, normalize the host. youtu.be is left
  // alone because it's a separate shortener domain.
  if (host === "youtu.be") {
    return `https://youtu.be${path}`;
  }
  return `https://www.youtube.com${path}`;
}

/**
 * Best-effort short label for a stored TikTok/YouTube URL or legacy handle.
 * Used when rendering "TikTok — @username" style labels. Falls back to the
 * raw stored value if no handle can be extracted.
 */
export function socialProfileLabel(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = scrubMarkdownEscapesInSocialPaste(value.trim());
  if (!trimmed) return null;
  if (!/^https?:\/\//i.test(trimmed)) {
    // Legacy bare handle.
    return `@${trimmed.replace(/^@+/, "")}`;
  }
  try {
    const u = new URL(trimmed);
    const segments = u.pathname.split("/").filter(Boolean);
    if (segments.length === 0) return u.hostname.replace(/^www\./, "");
    const first = segments[0];
    if (first.startsWith("@")) return first;
    return `@${first.replace(/^@/, "")}`;
  } catch {
    return trimmed;
  }
}

/**
 * Resolve a stored TikTok value (URL or legacy handle) to a clickable URL.
 * Returns null when the stored value can't be turned into a URL.
 */
export function tiktokProfileHref(
  value: string | null | undefined,
): string | null {
  if (!value) return null;
  const trimmed = scrubMarkdownEscapesInSocialPaste(value.trim());
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed)) {
    return normalizeTiktokProfileUrl(trimmed) ?? trimmed;
  }
  return normalizeTiktokProfileUrl(trimmed);
}

/**
 * Resolve a stored YouTube value (URL or legacy handle) to a clickable URL.
 * Returns null when the stored value can't be turned into a URL.
 */
export function youtubeProfileHref(
  value: string | null | undefined,
): string | null {
  if (!value) return null;
  const trimmed = scrubMarkdownEscapesInSocialPaste(value.trim());
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed)) {
    return normalizeYoutubeProfileUrl(trimmed) ?? trimmed;
  }
  return normalizeYoutubeProfileUrl(trimmed);
}
