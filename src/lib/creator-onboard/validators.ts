/** Snowflake-style Discord user id (string of digits). */
export function isDiscordUserId(value: string): boolean {
  return /^\d{17,20}$/.test(value.trim());
}

export function stripAtHandle(raw: string | undefined | null): string | null {
  if (raw == null) return null;
  const t = raw.trim().replace(/^@+/, "");
  return t.length > 0 ? t : null;
}
