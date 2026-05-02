import type { SupabaseClient } from "@supabase/supabase-js";

/** Crest/logo for embeds (DB often stores `/file.png` — absolute + path-encoded). */
export function absoluteSiteAssetUrl(
  pathOrUrl: string | null | undefined,
  siteBaseRaw: string,
): string | null {
  const raw = pathOrUrl?.trim();
  if (!raw) return null;

  try {
    if (raw.startsWith("https://") || raw.startsWith("http://")) {
      const u = new URL(raw);
      return u.href;
    }

    const baseStr = siteBaseRaw.replace(/\/$/, "").trim();
    if (!baseStr) return null;
    const base = new URL(baseStr);

    const rel = raw.startsWith("/") ? raw.slice(1) : raw;
    const pathEncoded =
      "/" +
      rel
        .split("/")
        .filter(Boolean)
        .map((segment) => {
          try {
            return encodeURIComponent(decodeURIComponent(segment));
          } catch {
            return encodeURIComponent(segment);
          }
        })
        .join("/");

    const out = `${base.origin}${pathEncoded}`;
    const check = new URL(out);
    if (check.protocol !== "http:" && check.protocol !== "https:") return null;
    return check.href;
  } catch {
    return null;
  }
}

export async function fetchTeamLogoUrl(
  supabase: SupabaseClient,
  teamSlug: string,
  siteBase: string,
): Promise<string | null> {
  const { data } = await supabase
    .from("teams")
    .select("logo_url")
    .eq("slug", teamSlug)
    .maybeSingle();
  return absoluteSiteAssetUrl(data?.logo_url, siteBase);
}
