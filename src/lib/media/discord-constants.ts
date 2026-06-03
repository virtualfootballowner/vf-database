/** Claim / unclaim by slot — suffix is assignment UUID. */
export const MEDIA_SLOT_CLAIM_STREAMER = "vfl:media:assign:c:stream:";
export const MEDIA_SLOT_CLAIM_COMMENTATOR = "vfl:media:assign:c:comm:";
export const MEDIA_SLOT_UNCLAIM_STREAMER = "vfl:media:assign:u:stream:";
export const MEDIA_SLOT_UNCLAIM_COMMENTATOR = "vfl:media:assign:u:comm:";

export type MediaAssignmentSlot = "streamer" | "commentator";
