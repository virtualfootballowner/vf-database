/**
 * Resolve TikTok share / redirect URLs to canonical /@user/video/{id} form so
 * Apify and our lookup keys stay consistent with what the scraper returns.
 */

const EXPAND_TIMEOUT_MS = 12_000;

function hasTiktokVideoPath(pathname: string): boolean {
  return /\/video\/\d+/i.test(pathname);
}

/** True when the URL is likely a short link or mobile redirect, not a direct video URL. */
export function tiktokUrlLikelyNeedsExpansion(url: string): boolean {
  try {
    const u = new URL(url);
    const h = u.hostname.toLowerCase();
    const p = u.pathname;

    if (h === "vm.tiktok.com" || h === "vt.tiktok.com") return true;
    if (hasTiktokVideoPath(p)) return false;

    if (h.includes("tiktok.com")) {
      if (/^\/t\//i.test(p)) return true;
      if ((h === "m.tiktok.com" || h === "www.tiktok.com") && p.length > 1) {
        // Bare path like /@handle without /video/ — sometimes share targets; try expand
        if (p.includes("/video/")) return false;
      }
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * Follow redirects (GET + abort body) and return the final URL.
 * Falls back to the original string on failure.
 */
export async function expandTiktokUrlIfNeeded(url: string): Promise<string> {
  const trimmed = url.trim();
  if (!trimmed || !tiktokUrlLikelyNeedsExpansion(trimmed)) {
    return trimmed;
  }

  const controller = new AbortController();
  const to = setTimeout(() => controller.abort(), EXPAND_TIMEOUT_MS);
  try {
    const res = await fetch(trimmed, {
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
      headers: {
        Accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
      },
    });
    clearTimeout(to);
    const finalUrl = res.url?.trim() || trimmed;
    void res.body?.cancel().catch(() => undefined);

    try {
      const out = new URL(finalUrl);
      if (
        out.hostname.toLowerCase().includes("tiktok.com") &&
        hasTiktokVideoPath(out.pathname)
      ) {
        return finalUrl;
      }
    } catch {
      /* keep trimmed */
    }
  } catch (e) {
    clearTimeout(to);
    console.warn("[tiktok-expand] failed for", trimmed.slice(0, 80), e);
  }

  return trimmed;
}

/** Expand many unique TikTok URLs with bounded concurrency. */
export async function expandTiktokUrlsForSync(
  urls: Iterable<string>,
): Promise<Map<string, string>> {
  const unique = [...new Set([...urls].map((u) => u.trim()).filter(Boolean))];
  const out = new Map<string, string>();

  if (unique.length === 0) return out;

  let index = 0;
  const concurrency = Math.min(8, unique.length);

  async function worker(): Promise<void> {
    for (;;) {
      const i = index++;
      if (i >= unique.length) return;
      const raw = unique[i];
      const resolved = await expandTiktokUrlIfNeeded(raw);
      out.set(raw, resolved);
    }
  }

  await Promise.all(Array.from({ length: concurrency }, () => worker()));
  return out;
}
