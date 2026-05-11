/** Strip `/rest/v1` so the JS client talks to the project root. */
export function normalizeSupabaseUrl(rawUrl: string): string {
  const url = new URL(rawUrl);
  url.pathname = url.pathname.replace(/\/rest\/v1\/?$/, "/");
  return url.toString().replace(/\/$/, "");
}
