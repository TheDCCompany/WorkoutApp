/**
 * Hand-written DB row shapes. We can replace these with `supabase gen types`
 * output once the schema settles, but for the MVP keeping them inline is fine.
 */

import type { ExerciseWorkoutMode, MuscleGroup } from "./domain";

export interface ProfileRow {
  id: string;
  display_name: string | null;
  onboarded_at: string | null;
  created_at: string;
}

export interface ExerciseRow {
  id: string;
  exercise_name: string;
  slug: string;
  primary_muscle_group: MuscleGroup;
  secondary_muscle_groups: string[];
  movement_pattern: string | null;
  equipment_type: string;
  bodyweight_compatible: boolean;
  workout_mode: ExerciseWorkoutMode;
  compound_or_isolation: "Compound" | "Isolation";
  unilateral: boolean;
  hypertrophy_tier: number;
  fatigue_score_1_10: number;
  axial_fatigue_1_10: number;
  systemic_fatigue_1_10: number;
  setup_complexity_1_10: number;
  stability_requirement_1_10: number;
  progression_type: string;
  recommended_rep_min: number;
  recommended_rep_max: number;
  default_sets_min: number;
  default_sets_max: number;
  default_rest_seconds: number;
  estimated_time_minutes: number;
  beginner_friendly: boolean;
  max_test_eligible: boolean;
  superset_friendly: boolean;
  superset_pairing_preference: string[];
  avoid_superset_with: string[];
  stimulus_to_fatigue_rating: string | null;
  programming_notes: string | null;
}

export interface UserExercisePoolRow {
  user_id: string;
  exercise_id: string;
  added_at: string;
}

export interface UserExerciseMaxRow {
  user_id: string;
  exercise_id: string;
  one_rep_max_lbs: number;
  updated_at: string;
}

export interface WorkoutRow {
  id: string;
  user_id: string;
  workout_mode: "standard" | "bodyweight";
  available_minutes: number;
  target_muscle_groups: string[];
  reason: string | null;
  generated_at: string;
  started_at: string | null;
  completed_at: string | null;
}

export interface WorkoutExerciseRow {
  id: string;
  workout_id: string;
  exercise_id: string;
  order_index: number;
  notes: string | null;
}

export interface WorkoutSetRow {
  id: string;
  workout_exercise_id: string;
  set_index: number;
  target_reps_min: number;
  target_reps_max: number;
  recommended_weight_lbs: number | null;
  rest_seconds: number;
  actual_reps: number | null;
  actual_weight_lbs: number | null;
  completed: boolean;
}

export interface MuscleGroupRecoveryRow {
  user_id: string;
  muscle_group: string;
  last_trained_at: string | null;
  recent_hard_sets: number;
  average_fatigue_score: number;
  updated_at: string;
}

export interface ExercisePerformanceHistoryRow {
  id: string;
  user_id: string;
  exercise_id: string;
  performed_at: string;
  weight_lbs: number | null;
  reps: number | null;
  set_index: number;
  hit_top_of_range: boolean;
  missed_target: boolean;
}
