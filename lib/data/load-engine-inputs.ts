/**
 * Server-side helpers to assemble the inputs that lib/workout-engine needs.
 * Lives outside the engine itself so the engine stays pure and reusable.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Exercise } from "@/types/domain";
import type { ExerciseRow } from "@/types/database";

export async function loadUserPool(
  supabase: SupabaseClient,
  userId: string
): Promise<Exercise[]> {
  const { data, error } = await supabase
    .from("user_exercise_pool")
    .select("exercise:exercises ( * )")
    .eq("user_id", userId);

  if (error) throw error;
  return (data ?? [])
    .map((row) => {
      const ex = Array.isArray(row.exercise) ? row.exercise[0] : row.exercise;
      return ex as ExerciseRow | undefined;
    })
    .filter((e): e is ExerciseRow => Boolean(e))
    .map(rowToExercise);
}

function rowToExercise(row: ExerciseRow): Exercise {
  return {
    id: row.id,
    exercise_name: row.exercise_name,
    slug: row.slug,
    primary_muscle_group: row.primary_muscle_group,
    secondary_muscle_groups: row.secondary_muscle_groups ?? [],
    movement_pattern: row.movement_pattern,
    equipment_type: row.equipment_type,
    bodyweight_compatible: row.bodyweight_compatible,
    workout_mode: row.workout_mode,
    compound_or_isolation: row.compound_or_isolation,
    unilateral: row.unilateral,
    hypertrophy_tier: row.hypertrophy_tier as 1 | 2 | 3 | 4,
    fatigue_score_1_10: row.fatigue_score_1_10,
    axial_fatigue_1_10: row.axial_fatigue_1_10,
    systemic_fatigue_1_10: row.systemic_fatigue_1_10,
    setup_complexity_1_10: row.setup_complexity_1_10,
    stability_requirement_1_10: row.stability_requirement_1_10,
    progression_type: row.progression_type,
    recommended_rep_min: row.recommended_rep_min,
    recommended_rep_max: row.recommended_rep_max,
    default_sets_min: row.default_sets_min,
    default_sets_max: row.default_sets_max,
    default_rest_seconds: row.default_rest_seconds,
    estimated_time_minutes: row.estimated_time_minutes,
    beginner_friendly: row.beginner_friendly,
    max_test_eligible: row.max_test_eligible,
    superset_friendly: row.superset_friendly,
    superset_pairing_preference: row.superset_pairing_preference ?? [],
    avoid_superset_with: row.avoid_superset_with ?? [],
    stimulus_to_fatigue_rating: row.stimulus_to_fatigue_rating,
    programming_notes: row.programming_notes,
  };
}

export async function loadMaxes(
  supabase: SupabaseClient,
  userId: string
): Promise<Map<string, number>> {
  const { data } = await supabase
    .from("user_exercise_maxes")
    .select("exercise_id, one_rep_max_lbs")
    .eq("user_id", userId);
  return new Map(
    (data ?? []).map((m) => [m.exercise_id, Number(m.one_rep_max_lbs)])
  );
}

/** Returns the latest weight logged per exercise. */
export async function loadLastLoggedWeights(
  supabase: SupabaseClient,
  userId: string
): Promise<Map<string, number>> {
  const { data } = await supabase
    .from("exercise_performance_history")
    .select("exercise_id, weight_lbs, performed_at")
    .eq("user_id", userId)
    .not("weight_lbs", "is", null)
    .order("performed_at", { ascending: false });

  const out = new Map<string, number>();
  for (const row of data ?? []) {
    if (!out.has(row.exercise_id) && row.weight_lbs != null) {
      out.set(row.exercise_id, Number(row.weight_lbs));
    }
  }
  return out;
}

/** Returns the latest performance timestamp per exercise (ISO string). */
export async function loadLastPerformed(
  supabase: SupabaseClient,
  userId: string
): Promise<Map<string, string | null>> {
  const { data } = await supabase
    .from("exercise_performance_history")
    .select("exercise_id, performed_at")
    .eq("user_id", userId)
    .order("performed_at", { ascending: false });
  const out = new Map<string, string | null>();
  for (const row of data ?? []) {
    if (!out.has(row.exercise_id)) out.set(row.exercise_id, row.performed_at);
  }
  return out;
}

export async function loadRecoveryRows(
  supabase: SupabaseClient,
  userId: string
) {
  const { data } = await supabase
    .from("muscle_group_recovery")
    .select(
      "muscle_group, last_trained_at, recent_hard_sets, average_fatigue_score"
    )
    .eq("user_id", userId);
  return data ?? [];
}
