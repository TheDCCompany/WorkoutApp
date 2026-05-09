/**
 * Deterministic workout generation engine.
 *
 * Inputs are pure data (the user's exercise pool, target muscle groups,
 * available time, mode, and prior usage). Output is a deterministic list
 * of exercises with planned sets/reps/rest/weight.
 *
 * No browser APIs, no Supabase calls — this lives in the lib layer and is
 * called from server-side code (Next.js server actions / route handlers)
 * which is responsible for fetching the inputs.
 */

import type {
  AvailableMinutes,
  Exercise,
  GeneratedWorkout,
  HypertrophyTier,
  MuscleGroup,
  PlannedExercise,
  PlannedSet,
  WorkoutMode,
} from "@/types/domain";
import { recommendWeight } from "@/lib/weight/recommend";

// ---------------------------------------------------------------------------
// Time bucket → exercise count
// ---------------------------------------------------------------------------
const TIME_TO_COUNT: Record<AvailableMinutes, { min: number; max: number }> = {
  20: { min: 2, max: 3 },
  30: { min: 3, max: 4 },
  45: { min: 4, max: 6 },
  60: { min: 5, max: 8 },
  75: { min: 6, max: 10 },
};

export function exerciseCountFor(minutes: AvailableMinutes) {
  return TIME_TO_COUNT[minutes];
}

// ---------------------------------------------------------------------------
// Filtering
// ---------------------------------------------------------------------------
export function filterByWorkoutMode(
  exercises: Exercise[],
  mode: WorkoutMode
): Exercise[] {
  if (mode === "standard") {
    return exercises.filter(
      (e) => e.workout_mode === "standard" || e.workout_mode === "both"
    );
  }
  return exercises.filter(
    (e) => e.workout_mode === "bodyweight" || e.workout_mode === "both"
  );
}

export function filterByUserPool(
  exercises: Exercise[],
  poolIds: Set<string>
): Exercise[] {
  return exercises.filter((e) => poolIds.has(e.id));
}

export function filterByMuscleGroups(
  exercises: Exercise[],
  groups: MuscleGroup[]
): Exercise[] {
  if (groups.length === 0) return exercises;
  if (groups.includes("Full Body")) {
    // Full body picks compound work across the body. We accept anything
    // tagged Full Body or any compound exercise.
    return exercises.filter(
      (e) =>
        e.primary_muscle_group === "Full Body" ||
        e.compound_or_isolation === "Compound"
    );
  }
  const set = new Set(groups);
  return exercises.filter((e) => set.has(e.primary_muscle_group));
}

// ---------------------------------------------------------------------------
// Selection scoring
// ---------------------------------------------------------------------------
export interface SelectionContext {
  /** Map of exercise_id -> last-performed timestamp (ISO). */
  lastPerformedByExerciseId: Map<string, string | null>;
  /** Reference time for "days since" calculations. */
  now: Date;
}

interface ScoredExercise {
  exercise: Exercise;
  score: number;
}

function score(exercise: Exercise, ctx: SelectionContext): number {
  // Base score = 100 - (tier * 10). Tier 1 = 90, Tier 4 = 60.
  const tierScore = 100 - exercise.hypertrophy_tier * 10;

  // Reward exercises that haven't been used recently. 0 penalty if never used.
  const last = ctx.lastPerformedByExerciseId.get(exercise.id);
  let recencyScore = 30;
  if (last) {
    const days = Math.max(
      0,
      Math.floor(
        (ctx.now.getTime() - new Date(last).getTime()) / 86_400_000
      )
    );
    // 0 days = 0 points, 7+ days = full 30 points.
    recencyScore = Math.min(30, days * 5);
  }

  // Lower fatigue is generally preferred so we can do more volume.
  const fatigueScore = (10 - exercise.fatigue_score_1_10) * 1;

  return tierScore + recencyScore + fatigueScore;
}

export function selectExercises(
  candidates: Exercise[],
  targetGroups: MuscleGroup[],
  budgetMinutes: number,
  countRange: { min: number; max: number },
  ctx: SelectionContext
): Exercise[] {
  const ranked: ScoredExercise[] = candidates
    .map((e) => ({ exercise: e, score: score(e, ctx) }))
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      // Deterministic tie-break: alphabetical name.
      return a.exercise.exercise_name.localeCompare(b.exercise.exercise_name);
    });

  const picked: Exercise[] = [];
  let timeUsed = 0;
  const groupCounts = new Map<MuscleGroup, number>();
  const namePool = new Set<string>();

  for (const { exercise } of ranked) {
    if (picked.length >= countRange.max) break;
    if (namePool.has(exercise.id)) continue;

    const wouldExceed = timeUsed + exercise.estimated_time_minutes > budgetMinutes;
    if (wouldExceed && picked.length >= countRange.min) break;
    if (wouldExceed) continue;

    // Spread across target groups if more than one group is targeted.
    if (targetGroups.length > 1) {
      const max =
        Math.ceil(countRange.max / targetGroups.length) +
        (targetGroups.length === 2 ? 1 : 0);
      const cur = groupCounts.get(exercise.primary_muscle_group) ?? 0;
      if (cur >= max) continue;
    }

    picked.push(exercise);
    namePool.add(exercise.id);
    timeUsed += exercise.estimated_time_minutes;
    groupCounts.set(
      exercise.primary_muscle_group,
      (groupCounts.get(exercise.primary_muscle_group) ?? 0) + 1
    );
  }

  return picked;
}

// ---------------------------------------------------------------------------
// Set/rep/weight planning
// ---------------------------------------------------------------------------
function midSets(min: number, max: number): number {
  return Math.round((min + max) / 2);
}

export function planExercise(
  exercise: Exercise,
  oneRepMaxLbs: number | null | undefined,
  lastLoggedWeightLbs: number | null | undefined,
  orderIndex: number
): PlannedExercise {
  const setCount = midSets(exercise.default_sets_min, exercise.default_sets_max);
  const sets: PlannedSet[] = [];
  for (let i = 0; i < setCount; i++) {
    sets.push({
      set_index: i,
      target_reps_min: exercise.recommended_rep_min,
      target_reps_max: exercise.recommended_rep_max,
      recommended_weight_lbs: recommendWeight({
        oneRepMaxLbs: oneRepMaxLbs ?? null,
        lastLoggedWeightLbs: lastLoggedWeightLbs ?? null,
        repRange: {
          min: exercise.recommended_rep_min,
          max: exercise.recommended_rep_max,
        },
      }),
      rest_seconds: exercise.default_rest_seconds,
    });
  }
  return {
    exercise,
    order_index: orderIndex,
    sets,
    notes: exercise.programming_notes,
  };
}

// ---------------------------------------------------------------------------
// Top-level orchestrator
// ---------------------------------------------------------------------------
export interface GenerateInput {
  pool: Exercise[];
  targetGroups: MuscleGroup[];
  reason: string;
  workoutMode: WorkoutMode;
  availableMinutes: AvailableMinutes;
  oneRepMaxLbsByExerciseId: Map<string, number>;
  lastLoggedWeightLbsByExerciseId: Map<string, number>;
  lastPerformedByExerciseId: Map<string, string | null>;
  now?: Date;
}

export function generateWorkout(input: GenerateInput): GeneratedWorkout {
  const now = input.now ?? new Date();
  const counts = exerciseCountFor(input.availableMinutes);

  // Step 1: filter by workout mode
  let candidates = filterByWorkoutMode(input.pool, input.workoutMode);
  // Step 2: filter by target groups
  const groupCandidates = filterByMuscleGroups(candidates, input.targetGroups);
  candidates =
    groupCandidates.length > 0 ? groupCandidates : candidates; // fallback: anything in mode

  // Step 3: select using scoring
  const selected = selectExercises(
    candidates,
    input.targetGroups,
    input.availableMinutes,
    counts,
    { lastPerformedByExerciseId: input.lastPerformedByExerciseId, now }
  );

  // Step 4: plan sets/reps/weight
  const exercises = selected.map((ex, i) =>
    planExercise(
      ex,
      input.oneRepMaxLbsByExerciseId.get(ex.id) ?? null,
      input.lastLoggedWeightLbsByExerciseId.get(ex.id) ?? null,
      i
    )
  );

  const totalMinutes = selected.reduce(
    (sum, ex) => sum + ex.estimated_time_minutes,
    0
  );

  return {
    target_muscle_groups: input.targetGroups,
    reason: input.reason,
    workout_mode: input.workoutMode,
    available_minutes: input.availableMinutes,
    estimated_total_minutes: totalMinutes,
    exercises,
  };
}

export type { HypertrophyTier };
