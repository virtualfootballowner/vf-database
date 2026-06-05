export type ParsedPlayerStat = {
  username: string;
  count: number;
};

/** Parse `booskioo, rykiraa x2, wiz (3)` into structured rows. */
export function parsePlayerStatList(
  raw: string | null | undefined,
): ParsedPlayerStat[] {
  if (!raw?.trim()) return [];

  const out: ParsedPlayerStat[] = [];
  for (const part of raw.split(/[,;\n]+/).map((s) => s.trim()).filter(Boolean)) {
    let username = part;
    let count = 1;

    const xMatch = /^(.+?)\s+x(\d+)$/i.exec(part);
    const parenMatch = /^(.+?)\s+\((\d+)\)$/.exec(part);
    if (xMatch) {
      username = xMatch[1]!.trim();
      count = Number.parseInt(xMatch[2]!, 10);
    } else if (parenMatch) {
      username = parenMatch[1]!.trim();
      count = Number.parseInt(parenMatch[2]!, 10);
    }

    if (!username || !Number.isFinite(count) || count < 1) continue;
    out.push({ username, count });
  }
  return out;
}

export function parseSinglePlayer(
  raw: string | null | undefined,
): string | null {
  const trimmed = raw?.trim();
  return trimmed || null;
}

/** Accept `2-1`, `2 - 1`, or `2:1`. First number = home score. */
export function parseScoreline(
  raw: string,
): { home: number; away: number } | null {
  const m = raw.trim().match(/^(\d+)\s*[-:]\s*(\d+)$/);
  if (!m) return null;
  const home = Number.parseInt(m[1]!, 10);
  const away = Number.parseInt(m[2]!, 10);
  if (!Number.isFinite(home) || !Number.isFinite(away)) return null;
  if (home < 0 || away < 0 || home > 99 || away > 99) return null;
  return { home, away };
}

export function formatPlayerStatLines(stats: ParsedPlayerStat[]): string {
  if (stats.length === 0) return "_None_";
  return stats
    .map((s) => (s.count > 1 ? `**${s.username}** ×${s.count}` : `**${s.username}**`))
    .join("\n");
}
