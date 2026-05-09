/**
 * Progressive overload rules. Given the previous performance on an exercise,
 * decide what next session's recommendation should look like.
 */

export interface SetResult {
  target_reps_min: number;
  target_reps_max: number;
  actual_reps: number;
  weight_lbs: number;
  completed: boolean;
}

export interface ProgressionDecision {
  /** Multiplier to apply to last weight, e.g. 1.025 for +2.5%. */
  weightMultiplier: number;
  rationale:
    | "skipped"
    | "all_sets_top_of_range"
    | "in_range_no_change"
    | "missed_reps_hold"
    | "missed_reps_reduce";
}

const TOP_INCREASE = 1.025; // 2.5%; rounded weight gives the user something tangible
const MISS_DECREASE = 0.95;

export function decideNextWeight(sets: SetResult[]): ProgressionDecision {
  if (sets.length === 0 || sets.every((s) => !s.completed)) {
    return { weightMultiplier: 1, rationale: "skipped" };
  }

  const completedSets = sets.filter((s) => s.completed);
  const allHitTopOfRange = completedSets.every(
    (s) => s.actual_reps >= s.target_reps_max
  );
  if (allHitTopOfRange) {
    return { weightMultiplier: TOP_INCREASE, rationale: "all_sets_top_of_range" };
  }

  const allInRange = completedSets.every(
    (s) =>
      s.actual_reps >= s.target_reps_min && s.actual_reps <= s.target_reps_max
  );
  if (allInRange) {
    return { weightMultiplier: 1, rationale: "in_range_no_change" };
  }

  // Some sets missed the target. If the worst miss was significant (>= 2 short
  // of the lower bound), step the weight down. Otherwise hold.
  const worstShortfall = completedSets.reduce((max, s) => {
    const shortfall = s.target_reps_min - s.actual_reps;
    return shortfall > max ? shortfall : max;
  }, 0);

  if (worstShortfall >= 2) {
    return { weightMultiplier: MISS_DECREASE, rationale: "missed_reps_reduce" };
  }
  return { weightMultiplier: 1, rationale: "missed_reps_hold" };
}

export function applyDecision(
  lastWeightLbs: number,
  decision: ProgressionDecision
): number {
  return Math.round((lastWeightLbs * decision.weightMultiplier) / 5) * 5;
}
