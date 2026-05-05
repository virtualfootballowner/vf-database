/**
 * Standard ELO math used by the FACEIT-style scrimmage system.
 *
 * Spec:
 *  - Base K-factor = 25
 *  - Expected score from team-average rating difference (Elo logistic curve)
 *  - Win → +K * (1 - expected)
 *  - Loss → +K * (0 - expected) = -K * expected
 *  - Draw → +K * (0.5 - expected)
 *  - V1 has no per-goal / per-assist bonuses; every player on the same team
 *    gets the same delta. Individual bonuses are TBD when the Roblox auto-
 *    pipeline lands.
 *
 * Outputs are integers (rounded). Deltas are clamped to a sane range to
 * protect against bad inputs (e.g. a 1500-rated team beating a 0-rated team
 * shouldn't spike +200 ELO; the spec implies max ±40 in the simplified table).
 */

export const SCRIMMAGE_BASE_K = 25;
export const SCRIMMAGE_DEFAULT_ELO = 1000;
/** Hard ceiling — even a heavy upset shouldn't move more than this. */
export const SCRIMMAGE_MAX_DELTA = 40;
/** Hard floor — a clean win against a much weaker team should still be > 0. */
export const SCRIMMAGE_MIN_WIN_DELTA = 5;
/** Symmetric floor for losses against weaker opponents. */
export const SCRIMMAGE_MIN_LOSS_DELTA = -SCRIMMAGE_MAX_DELTA;

export type ScrimmageOutcome = "win" | "loss" | "draw";

/** Logistic expected score given two team ratings. */
export function expectedScore(myRating: number, oppRating: number): number {
  const diff = oppRating - myRating;
  return 1 / (1 + Math.pow(10, diff / 400));
}

/**
 * Compute the integer ELO delta for one player on one team given the
 * team-average ratings + outcome. K = SCRIMMAGE_BASE_K.
 */
export function eloDelta(args: {
  myTeamAvg: number;
  oppTeamAvg: number;
  outcome: ScrimmageOutcome;
}): number {
  const { myTeamAvg, oppTeamAvg, outcome } = args;
  const expected = expectedScore(myTeamAvg, oppTeamAvg);
  const actual =
    outcome === "win" ? 1 : outcome === "loss" ? 0 : 0.5;
  const raw = SCRIMMAGE_BASE_K * (actual - expected);
  let rounded = Math.round(raw);

  // Clamp to spec's simplified range. Wins always cross the floor up.
  if (outcome === "win" && rounded < SCRIMMAGE_MIN_WIN_DELTA) {
    rounded = SCRIMMAGE_MIN_WIN_DELTA;
  }
  if (rounded > SCRIMMAGE_MAX_DELTA) rounded = SCRIMMAGE_MAX_DELTA;
  if (rounded < SCRIMMAGE_MIN_LOSS_DELTA) rounded = SCRIMMAGE_MIN_LOSS_DELTA;
  return rounded;
}

/**
 * Compute the post-match deltas for an entire scrimmage given each player's
 * pre-match rating. Returns a map of player_id → delta keyed by team. Every
 * player on the winning team gets the same number; same for the losing team.
 */
export function computeScrimmageDeltas(args: {
  team1: { player_id: string; elo: number }[];
  team2: { player_id: string; elo: number }[];
  team1Score: number;
  team2Score: number;
}): {
  team1Avg: number;
  team2Avg: number;
  team1Delta: number;
  team2Delta: number;
  perPlayer: Map<string, number>;
} {
  const { team1, team2, team1Score, team2Score } = args;
  const team1Avg = avgElo(team1);
  const team2Avg = avgElo(team2);

  let team1Outcome: ScrimmageOutcome;
  let team2Outcome: ScrimmageOutcome;
  if (team1Score > team2Score) {
    team1Outcome = "win";
    team2Outcome = "loss";
  } else if (team2Score > team1Score) {
    team1Outcome = "loss";
    team2Outcome = "win";
  } else {
    team1Outcome = "draw";
    team2Outcome = "draw";
  }

  const team1Delta = eloDelta({
    myTeamAvg: team1Avg,
    oppTeamAvg: team2Avg,
    outcome: team1Outcome,
  });
  const team2Delta = eloDelta({
    myTeamAvg: team2Avg,
    oppTeamAvg: team1Avg,
    outcome: team2Outcome,
  });

  const perPlayer = new Map<string, number>();
  for (const p of team1) perPlayer.set(p.player_id, team1Delta);
  for (const p of team2) perPlayer.set(p.player_id, team2Delta);

  return { team1Avg, team2Avg, team1Delta, team2Delta, perPlayer };
}

/** Integer team-average ELO rounded half-up. Empty teams return the seed. */
function avgElo(team: { elo: number }[]): number {
  if (team.length === 0) return SCRIMMAGE_DEFAULT_ELO;
  const sum = team.reduce((acc, p) => acc + p.elo, 0);
  return Math.round(sum / team.length);
}
