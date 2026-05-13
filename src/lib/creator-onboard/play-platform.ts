import { z } from "zod";

export const CREATOR_PLAY_PLATFORM_VALUES = ["pc", "mobile", "console"] as const;

export type CreatorPlayPlatform = (typeof CREATOR_PLAY_PLATFORM_VALUES)[number];

export const CREATOR_PLAY_PLATFORM_LABEL: Record<CreatorPlayPlatform, string> = {
  pc: "PC",
  mobile: "Mobile",
  console: "Console",
};

export const creatorPlayPlatformSchema = z.enum(CREATOR_PLAY_PLATFORM_VALUES);

export function isCreatorPlayPlatform(
  v: string,
): v is CreatorPlayPlatform {
  return (CREATOR_PLAY_PLATFORM_VALUES as readonly string[]).includes(v);
}

/** Human-readable label for staff/UI, or null if unset/invalid. */
export function formatCreatorPlayPlatform(
  raw: string | null | undefined,
): string | null {
  if (raw == null || typeof raw !== "string") return null;
  const s = raw.trim().toLowerCase();
  if (!isCreatorPlayPlatform(s)) return null;
  return CREATOR_PLAY_PLATFORM_LABEL[s];
}
