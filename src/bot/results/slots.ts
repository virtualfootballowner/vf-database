import type { ChatInputCommandInteraction } from "discord.js";

import { parsePlayerStatList } from "@/bot/results/parse";

export const SCORER_SLOT_NAMES = Array.from(
  { length: 8 },
  (_, i) => `scorer_${i + 1}`,
) as [
  "scorer_1",
  "scorer_2",
  "scorer_3",
  "scorer_4",
  "scorer_5",
  "scorer_6",
  "scorer_7",
  "scorer_8",
];

export const ASSIST_SLOT_NAMES = Array.from(
  { length: 5 },
  (_, i) => `assist_${i + 1}`,
) as ["assist_1", "assist_2", "assist_3", "assist_4", "assist_5"];

export const YELLOW_CARD_SLOT_NAMES = Array.from(
  { length: 3 },
  (_, i) => `yellow_card_${i + 1}`,
) as ["yellow_card_1", "yellow_card_2", "yellow_card_3"];

export const RED_CARD_SLOT_NAMES = Array.from(
  { length: 2 },
  (_, i) => `red_card_${i + 1}`,
) as ["red_card_1", "red_card_2"];

export const RESULT_PLAYER_AUTOCOMPLETE_FIELDS = [
  ...SCORER_SLOT_NAMES,
  ...ASSIST_SLOT_NAMES,
  "motm",
  ...YELLOW_CARD_SLOT_NAMES,
  ...RED_CARD_SLOT_NAMES,
] as const;

/** Merge slot picks; same player in multiple scorer slots adds to their goal count. */
export function collectPlayerStatsFromSlots(
  interaction: ChatInputCommandInteraction,
  slotNames: readonly string[],
): ReturnType<typeof parsePlayerStatList> {
  const merged = new Map<string, number>();

  for (const slot of slotNames) {
    const raw = interaction.options.getString(slot)?.trim();
    if (!raw) continue;

    const parsed = parsePlayerStatList(raw);
    const entries =
      parsed.length > 0 ? parsed : [{ username: raw, count: 1 as const }];

    for (const entry of entries) {
      merged.set(
        entry.username,
        (merged.get(entry.username) ?? 0) + entry.count,
      );
    }
  }

  return [...merged.entries()].map(([username, count]) => ({ username, count }));
}
