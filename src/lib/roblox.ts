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
