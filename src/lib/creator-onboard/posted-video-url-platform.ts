export type PostedVideoPlatform = "youtube" | "tiktok" | "other";

export function classifyPostedVideoUrl(url: string): PostedVideoPlatform {
  try {
    const host = new URL(url).hostname.toLowerCase();
    if (
      host === "youtu.be" ||
      host.includes("youtube.com") ||
      host.includes("youtube-nocookie.com")
    ) {
      return "youtube";
    }
    if (host.includes("tiktok.com") || host === "vm.tiktok.com") {
      return "tiktok";
    }
  } catch {
    return "other";
  }
  return "other";
}

/** 11-char YouTube video id when parsable. */
export function extractYoutubeVideoId(url: string): string | null {
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase();
    if (host === "youtu.be") {
      const id = u.pathname.replace(/^\//, "").split("/")[0]?.trim() ?? "";
      return /^[\w-]{11}$/.test(id) ? id : null;
    }
    if (host.includes("youtube.com") || host.includes("youtube-nocookie.com")) {
      const v = u.searchParams.get("v");
      if (v && /^[\w-]{11}$/.test(v)) return v;
      const m = u.pathname.match(/\/(?:shorts|embed|live)\/([\w-]{11})/);
      if (m?.[1] && /^[\w-]{11}$/.test(m[1])) return m[1];
    }
  } catch {
    return null;
  }
  return null;
}

export function normalizeTiktokUrlKey(url: string): string {
  try {
    const u = new URL(url);
    u.hash = "";
    u.search = "";
    let out = u.href;
    if (out.endsWith("/")) out = out.slice(0, -1);
    return out.toLowerCase();
  } catch {
    return url.trim().toLowerCase();
  }
}

/** Numeric TikTok video id when parsable from a canonical /video/{id} URL. */
export function extractTiktokVideoId(url: string): string | null {
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase();
    if (!host.includes("tiktok.com") && host !== "vm.tiktok.com") return null;
    const m = u.pathname.match(/\/video\/(\d+)/i);
    return m?.[1] ?? null;
  } catch {
    return null;
  }
}

/** Stable identity for duplicate detection (YouTube id, TikTok id, or normalized URL). */
export function postedVideoCanonicalKey(url: string): string {
  const platform = classifyPostedVideoUrl(url);
  if (platform === "youtube") {
    const id = extractYoutubeVideoId(url);
    if (id) return `youtube:${id}`;
  }
  if (platform === "tiktok") {
    const id = extractTiktokVideoId(url);
    if (id) return `tiktok:${id}`;
    return `tiktok:${normalizeTiktokUrlKey(url)}`;
  }
  try {
    const u = new URL(url);
    u.hash = "";
    return u.href;
  } catch {
    return url.trim().toLowerCase();
  }
}

/** True when two posted links refer to the same video (including URL variants). */
export function postedVideoUrlsAreDuplicate(a: string, b: string): boolean {
  if (postedVideoCanonicalKey(a) === postedVideoCanonicalKey(b)) return true;
  try {
    return new URL(a).href === new URL(b).href;
  } catch {
    return a.trim() === b.trim();
  }
}
