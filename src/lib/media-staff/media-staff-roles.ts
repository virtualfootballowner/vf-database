import { z } from "zod";

export const MEDIA_STAFF_ROLE_KEYS = [
  "reporter",
  "gfx_maker",
  "streamer",
  "commentator",
  "other",
] as const;

export type MediaStaffRoleKey = (typeof MEDIA_STAFF_ROLE_KEYS)[number];

export const MEDIA_STAFF_ROLE_LABEL: Record<MediaStaffRoleKey, string> = {
  reporter: "Reporter",
  gfx_maker: "GFX maker",
  streamer: "Streamer",
  commentator: "Commentator",
  other: "Other",
};

export const mediaStaffRoleKeySchema = z.enum(MEDIA_STAFF_ROLE_KEYS);

export function mediaStaffRoleLabel(key: string): string {
  const k = key as MediaStaffRoleKey;
  return MEDIA_STAFF_ROLE_LABEL[k] ?? key;
}
