/**
 * Recovery scoring per muscle group.
 *
 *   recovery_score = clamp(0..100, days_since_trained * 25 - fatigue_penalty)
 *   fatigue_penalty = recent_hard_sets * 3 + average_fatigue_score
 *
 * "recent_hard_sets" is the count of working sets performed in the last
 * ~3 calendar days; "average_fatigue_score" is the mean fatigue rating
 * (1-10) across exercises trained that hit this group in that window.
 */

import type {
  MuscleGroup,
  MuscleGroupOverride,
  RecoveryBand,
  RecoveryState,
} from "@/types/domain";
import {
  DIRECT_MUSCLE_GROUPS,
  LOWER_BODY_GROUPS,
  UPPER_BODY_GROUPS,
} from "@/types/domain";

export interface RecoveryInput {
  muscle_group: MuscleGroup;
  last_trained_at: Date | string | null;
  recent_hard_sets: number;
  average_fatigue_score: number;
}

export function daysSince(reference: Date, last: Date | string | null): number {
  if (!last) return 999;
  const lastDate = typeof last === "string" ? new Date(last) : last;
  const ms = reference.getTime() - lastDate.getTime();
  return Math.max(0, Math.floor(ms / (1000 * 60 * 60 * 24)));
}

export function computeRecoveryScore(
  input: RecoveryInput,
  now: Date = new Date()
): number {
  const days = daysSince(now, input.last_trained_at);
  const fatiguePenalty =
    input.recent_hard_sets * 3 + input.average_fatigue_score;
  const raw = days * 25 - fatiguePenalty;
  return Math.max(0, Math.min(100, Math.round(raw)));
}

export function bandFor(score: number): RecoveryBand {
  if (score >= 90) return { band: "fully_recovered", label: "Fully recovered" };
  if (score >= 70) return { band: "good", label: "Good to train" };
  if (score >= 50) return { band: "light", label: "Train lightly" };
  if (score >= 30) return { band: "avoid_direct", label: "Avoid direct hard work" };
  return { band: "rest", label: "Rest" };
}

export function buildRecoveryStates(
  inputs: RecoveryInput[],
  now: Date = new Date()
): RecoveryState[] {
  // Ensure every direct muscle group is represented, defaulting to "untrained
  // for a long time" when there's no history yet.
  const map = new Map<MuscleGroup, RecoveryInput>();
  for (const i of inputs) map.set(i.muscle_group, i);

  return DIRECT_MUSCLE_GROUPS.map((mg) => {
    const i = map.get(mg) ?? {
      muscle_group: mg,
      last_trained_at: null,
      recent_hard_sets: 0,
      average_fatigue_score: 0,
    };
    return {
      muscle_group: mg,
      last_trained_at:
        i.last_trained_at == null
          ? null
          : i.last_trained_at instanceof Date
          ? i.last_trained_at.toISOString()
          : String(i.last_trained_at),
      recovery_score: computeRecoveryScore(i, now),
      recent_hard_sets: i.recent_hard_sets,
      average_fatigue_score: i.average_fatigue_score,
    };
  });
}

interface RecommendationResult {
  groups: MuscleGroup[];
  reason: string;
}

const DEFAULT_PAIRINGS: [MuscleGroup, MuscleGroup][] = [
  ["Chest", "Triceps"],
  ["Back", "Biceps"],
  ["Quads", "Hamstrings"],
  ["Glutes", "Hamstrings"],
  ["Shoulders", "Triceps"],
  ["Back", "Shoulders"],
];

/**
 * Recommend which muscle group(s) to train next based on recovery scores.
 * Uses a simple heuristic: pick the most recovered direct group, then if
 * the available time supports more volume, add a complementary partner that
 * is also well-recovered.
 */
export function recommendMuscleGroups(
  states: RecoveryState[],
  options: { preferPair: boolean } = { preferPair: true }
): RecommendationResult {
  if (states.length === 0) {
    return { groups: ["Full Body"], reason: "No recovery data yet — full-body start." };
  }

  const trackedStates = states.filter((s) => s.last_trained_at != null);

  // Prefer groups with actual history. If the user has trained nothing yet,
  // fall back to the full list (which all read as max-recovered).
  const candidatePool = trackedStates.length > 0 ? trackedStates : states;

  const sorted = [...candidatePool].sort((a, b) => {
    if (b.recovery_score !== a.recovery_score)
      return b.recovery_score - a.recovery_score;
    // Tiebreak: prefer the group with the older last_trained_at (more rest).
    const aT = a.last_trained_at ? new Date(a.last_trained_at).getTime() : 0;
    const bT = b.last_trained_at ? new Date(b.last_trained_at).getTime() : 0;
    return aT - bT;
  });

  if (trackedStates.length === 0) {
    return {
      groups: ["Full Body"],
      reason: "No recovery data yet — full-body start.",
    };
  }

  const top = sorted[0];

  if (!options.preferPair) {
    return {
      groups: [top.muscle_group],
      reason: describeRecovery(top),
    };
  }

  // Find a pairing partner that's also recovered (>= 70)
  const partners = DEFAULT_PAIRINGS.filter(
    (p) => p[0] === top.muscle_group || p[1] === top.muscle_group
  );
  const partnerCandidates = partners.flatMap((p) =>
    p[0] === top.muscle_group ? [p[1]] : [p[0]]
  );
  const partner = sorted.find(
    (s) => partnerCandidates.includes(s.muscle_group) && s.recovery_score >= 70
  );

  if (partner) {
    return {
      groups: [top.muscle_group, partner.muscle_group],
      reason: `${describeRecovery(top)} ${describeRecovery(partner)}`.trim(),
    };
  }
  return { groups: [top.muscle_group], reason: describeRecovery(top) };
}

function describeRecovery(state: RecoveryState): string {
  if (!state.last_trained_at) {
    return `${state.muscle_group} hasn't been trained yet.`;
  }
  const days = daysSince(new Date(), state.last_trained_at);
  if (days === 0) return `${state.muscle_group} was trained today.`;
  if (days === 1) return `${state.muscle_group} had 1 day of rest.`;
  return `${state.muscle_group} has had ${days} days of rest.`;
}

export function expandOverride(
  override: MuscleGroupOverride
): MuscleGroup[] {
  if (override === "Upper Body") return UPPER_BODY_GROUPS;
  if (override === "Lower Body") return LOWER_BODY_GROUPS;
  return [override];
}
