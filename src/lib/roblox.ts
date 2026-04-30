export type RobloxIdentity = {
  username: string;
  userId: string;
};

type UsernameLookupResponse = {
  data: Array<{
    requestedUsername: string;
    id?: number;
    name?: string;
  }>;
};

export function extractRobloxUsername(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  // Support common nickname patterns like "PlayerName | Team" or "PlayerName [BRA]".
  const firstChunk = trimmed.split("|")[0]?.split("[")[0]?.trim() ?? "";
  if (!/^[A-Za-z0-9_]{3,20}$/.test(firstChunk)) return null;
  return firstChunk;
}

/** Lowercase Roblox username → numeric user id (for events missing robloxId in CSV). */
export async function resolveRobloxUserIdsByUsernames(
  usernames: string[],
): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  const unique = [
    ...new Set(usernames.map((u) => u.trim()).filter(Boolean)),
  ];
  if (unique.length === 0) return result;

  for (let i = 0; i < unique.length; i += 100) {
    const chunk = unique.slice(i, i + 100);
    try {
      const response = await fetch("https://users.roblox.com/v1/usernames/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          usernames: chunk,
          excludeBannedUsers: true,
        }),
        next: { revalidate: 86_400 },
      });
      if (!response.ok) continue;
      const payload = (await response.json()) as UsernameLookupResponse;
      for (const entry of payload.data ?? []) {
        if (!entry?.id || !entry?.name) continue;
        const id = String(entry.id);
        const req = entry.requestedUsername;
        if (req) result.set(req.toLowerCase(), id);
        result.set(entry.name.toLowerCase(), id);
      }
    } catch {
      // ignore – headshot falls back to initials
    }
  }

  return result;
}

export function effectiveRobloxPlayerId(
  robloxId: string | null,
  playerName: string,
  resolvedByLowerUsername: Map<string, string>,
): string | null {
  if (robloxId) return robloxId;
  const u = extractRobloxUsername(playerName);
  if (!u) return null;
  return resolvedByLowerUsername.get(u.toLowerCase()) ?? null;
}

export async function resolveRobloxIdentity(
  username: string,
  apiBaseUrl: string,
): Promise<RobloxIdentity | null> {
  const response = await fetch(`${apiBaseUrl}/v1/usernames/users`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      usernames: [username],
      excludeBannedUsers: true,
    }),
  });

  if (!response.ok) {
    throw new Error(`Roblox API lookup failed with status ${response.status}.`);
  }

  const payload = (await response.json()) as UsernameLookupResponse;
  const match = payload.data?.[0];
  if (!match?.id || !match?.name) return null;

  return {
    username: match.name,
    userId: String(match.id),
  };
}

type HeadshotResponse = {
  data: Array<{
    targetId: number;
    state: string;
    imageUrl: string;
  }>;
};

export async function getRobloxHeadshots(
  userIds: string[],
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (userIds.length === 0) return map;

  const unique = Array.from(new Set(userIds.filter(Boolean)));
  const chunks: string[][] = [];
  for (let i = 0; i < unique.length; i += 100) {
    chunks.push(unique.slice(i, i + 100));
  }

  await Promise.all(
    chunks.map(async (chunk) => {
      const url = `https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${chunk.join(
        ",",
      )}&size=150x150&format=Png&isCircular=true`;

      try {
        const response = await fetch(url, { next: { revalidate: 3600 } });
        if (!response.ok) return;
        const payload = (await response.json()) as HeadshotResponse;
        for (const entry of payload.data ?? []) {
          if (entry.state === "Completed" && entry.imageUrl) {
            map.set(String(entry.targetId), entry.imageUrl);
          }
        }
      } catch {
        // ignore network errors – fallback to monogram avatar
      }
    }),
  );

  return map;
}
