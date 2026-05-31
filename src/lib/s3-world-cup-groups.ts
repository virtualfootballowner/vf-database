export const S3_WORLD_CUP_GROUP_LETTERS = [
  "A",
  "B",
  "C",
  "D",
  "E",
  "F",
] as const;

export type S3WorldCupGroupLetter = (typeof S3_WORLD_CUP_GROUP_LETTERS)[number];

/** Draw order per group (slot 1–4 → seed A1…F4). Team slugs from the S3 roster. */
export const S3_WORLD_CUP_GROUPS: Record<
  S3WorldCupGroupLetter,
  readonly [string, string, string, string]
> = {
  A: ["nigeria", "portugal", "italy", "mexico"],
  B: ["spain", "albania", "greece", "england"],
  C: ["canada", "somalia", "france", "usa"],
  D: ["brazil", "argentina", "belgium", "ukraine"],
  E: ["germany", "morocco", "switzerland", "netherlands"],
  F: ["norway", "japan", "russia", "north-korea"],
};
