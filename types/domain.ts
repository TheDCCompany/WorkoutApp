export type WorkoutMode = "standard" | "bodyweight";

export type ExerciseWorkoutMode = "standard" | "bodyweight" | "both";

export type MuscleGroup =
  | "Chest"
  | "Back"
  | "Shoulders"
  | "Biceps"
  | "Triceps"
  | "Quads"
  | "Hamstrings"
  | "Glutes"
  | "Calves"
  | "Abs"
  | "Full Body";

export type MuscleGroupOverride =
  | MuscleGroup
  | "Upper Body"
  | "Lower Body";

export const ALL_OVERRIDE_OPTIONS: MuscleGroupOverride[] = [
  "Chest",
  "Back",
  "Shoulders",
  "Biceps",
  "Triceps",
  "Quads",
  "Hamstrings",
  "Glutes",
  "Calves",
  "Abs",
  "Upper Body",
  "Lower Body",
  "Full Body",
];

export const DIRECT_MUSCLE_GROUPS: MuscleGroup[] = [
  "Chest",
  "Back",
  "Shoulders",
  "Biceps",
  "Triceps",
  "Quads",
  "Hamstrings",
  "Glutes",
  "Calves",
  "Abs",
  "Full Body",
];

export const UPPER_BODY_GROUPS: MuscleGroup[] = [
  "Chest",
  "Back",
  "Shoulders",
  "Biceps",
  "Triceps",
];

export const LOWER_BODY_GROUPS: MuscleGroup[] = [
  "Quads",
  "Hamstrings",
  "Glutes",
  "Calves",
];

export type AvailableMinutes = 20 | 30 | 45 | 60 | 75;
export const AVAILABLE_MINUTE_OPTIONS: AvailableMinutes[] = [20, 30, 45, 60, 75];

export type HypertrophyTier = 1 | 2 | 3 | 4;

export interface Exercise {
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
  hypertrophy_tier: HypertrophyTier;
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

export interface RecoveryState {
  muscle_group: MuscleGroup;
  last_trained_at: string | null;
  recovery_score: number;
  recent_hard_sets: number;
  average_fatigue_score: number;
}

export interface RecoveryBand {
  band: "fully_recovered" | "good" | "light" | "avoid_direct" | "rest";
  label: string;
}

export interface PlannedSet {
  set_index: number;
  target_reps_min: number;
  target_reps_max: number;
  recommended_weight_lbs: number | null;
  rest_seconds: number;
}

export interface PlannedExercise {
  exercise: Exercise;
  order_index: number;
  sets: PlannedSet[];
  notes: string | null;
}

export interface GeneratedWorkout {
  target_muscle_groups: MuscleGroup[];
  reason: string;
  workout_mode: WorkoutMode;
  available_minutes: AvailableMinutes;
  estimated_total_minutes: number;
  exercises: PlannedExercise[];
}

export interface GenerateWorkoutInput {
  user_id: string;
  available_time_minutes: AvailableMinutes;
  workout_mode: WorkoutMode;
  override_muscle_group?: MuscleGroupOverride;
}
