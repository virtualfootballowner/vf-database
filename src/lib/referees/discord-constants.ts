/** Staff review — suffix is applicant Discord user id. */
export const REFEREE_APPROVE_PREFIX = "vfl:ref:approve:";

/** Staff review — suffix is applicant Discord user id. */
export const REFEREE_DENY_PREFIX = "vfl:ref:deny:";

/** Assignment claim (legacy — treated as main ref). Suffix is assignment UUID. */
export const REFEREE_ASSIGNMENT_CLAIM_PREFIX = "vfl:ref:assign:claim:";

/** Claim / unclaim by slot — suffix is assignment UUID. */
export const REFEREE_SLOT_CLAIM_MAIN = "vfl:ref:assign:c:main:";
export const REFEREE_SLOT_CLAIM_LINES = "vfl:ref:assign:c:lines:";
export const REFEREE_SLOT_UNCLAIM_MAIN = "vfl:ref:assign:u:main:";
export const REFEREE_SLOT_UNCLAIM_LINES = "vfl:ref:assign:u:lines:";

/** Postponement DM — suffix is response UUID. */
export const REFEREE_POSTPONE_KEEP_PREFIX = "vfl:ref:postpone:keep:";
export const REFEREE_POSTPONE_DROP_PREFIX = "vfl:ref:postpone:drop:";

export type RefereeAssignmentSlot = "main" | "linesman";
