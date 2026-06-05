/** Helpers for comma-separated player fields with Discord autocomplete. */

export function autocompleteQueryToken(raw: string): {
  prefix: string;
  token: string;
  alreadyPicked: string[];
} {
  const trimmed = raw.trimEnd();
  const lastComma = trimmed.lastIndexOf(",");
  if (lastComma === -1) {
    return {
      prefix: "",
      token: trimmed.trim().toLowerCase(),
      alreadyPicked: [],
    };
  }

  const prefix = trimmed.slice(0, lastComma + 1);
  const token = trimmed.slice(lastComma + 1).trim().toLowerCase();
  const alreadyPicked = trimmed
    .slice(0, lastComma)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return { prefix, token, alreadyPicked };
}

export function autocompleteMultiValue(prefix: string, username: string): string {
  if (!prefix) return username;
  return `${prefix} ${username}`;
}

export function parseUsernamesFromMultiField(raw: string): string[] {
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}
