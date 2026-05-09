-- =============================================================================
-- Workout App — initial schema
-- =============================================================================
-- Tables: profiles, exercises, user_exercise_pool, user_exercise_maxes,
--         workouts, workout_exercises, workout_sets, muscle_group_recovery,
--         exercise_performance_history
-- RLS: enabled on every user-owned table; library table is readable by all
--      authenticated users.
-- =============================================================================

create extension if not exists "pgcrypto";

-- -----------------------------------------------------------------------------
-- profiles — one row per auth.users entry, populated by a trigger.
-- -----------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  onboarded_at timestamptz,
  created_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id) values (new.id) on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- -----------------------------------------------------------------------------
-- exercises — global hypertrophy exercise library (read-only for users).
-- -----------------------------------------------------------------------------
create table if not exists public.exercises (
  id text primary key,
  exercise_name text not null,
  slug text not null unique,
  primary_muscle_group text not null,
  secondary_muscle_groups text[] not null default '{}',
  movement_pattern text,
  equipment_type text not null,
  bodyweight_compatible boolean not null default false,
  workout_mode text not null check (workout_mode in ('standard', 'bodyweight', 'both')),
  compound_or_isolation text not null check (compound_or_isolation in ('Compound', 'Isolation')),
  unilateral boolean not null default false,
  hypertrophy_tier smallint not null check (hypertrophy_tier between 1 and 4),
  fatigue_score_1_10 smallint not null check (fatigue_score_1_10 between 1 and 10),
  axial_fatigue_1_10 smallint not null check (axial_fatigue_1_10 between 0 and 10),
  systemic_fatigue_1_10 smallint not null check (systemic_fatigue_1_10 between 0 and 10),
  setup_complexity_1_10 smallint not null check (setup_complexity_1_10 between 1 and 10),
  stability_requirement_1_10 smallint not null check (stability_requirement_1_10 between 1 and 10),
  progression_type text not null,
  recommended_rep_min smallint not null,
  recommended_rep_max smallint not null,
  default_sets_min smallint not null,
  default_sets_max smallint not null,
  default_rest_seconds integer not null,
  estimated_time_minutes integer not null,
  beginner_friendly boolean not null default false,
  max_test_eligible boolean not null default false,
  superset_friendly boolean not null default false,
  superset_pairing_preference text[] not null default '{}',
  avoid_superset_with text[] not null default '{}',
  stimulus_to_fatigue_rating text,
  programming_notes text
);

create index if not exists exercises_primary_muscle_idx
  on public.exercises (primary_muscle_group);
create index if not exists exercises_workout_mode_idx
  on public.exercises (workout_mode);
create index if not exists exercises_tier_idx
  on public.exercises (hypertrophy_tier);

-- -----------------------------------------------------------------------------
-- user_exercise_pool — exercises a user has selected for their pool.
-- -----------------------------------------------------------------------------
create table if not exists public.user_exercise_pool (
  user_id uuid not null references public.profiles(id) on delete cascade,
  exercise_id text not null references public.exercises(id) on delete cascade,
  added_at timestamptz not null default now(),
  primary key (user_id, exercise_id)
);
create index if not exists user_exercise_pool_user_idx
  on public.user_exercise_pool (user_id);

-- -----------------------------------------------------------------------------
-- user_exercise_maxes — optional 1RM estimates per exercise.
-- -----------------------------------------------------------------------------
create table if not exists public.user_exercise_maxes (
  user_id uuid not null references public.profiles(id) on delete cascade,
  exercise_id text not null references public.exercises(id) on delete cascade,
  one_rep_max_lbs numeric(6,1) not null check (one_rep_max_lbs > 0),
  updated_at timestamptz not null default now(),
  primary key (user_id, exercise_id)
);

-- -----------------------------------------------------------------------------
-- workouts — one row per generated workout (whether or not it's completed).
-- -----------------------------------------------------------------------------
create table if not exists public.workouts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  workout_mode text not null check (workout_mode in ('standard', 'bodyweight')),
  available_minutes smallint not null check (available_minutes in (20, 30, 45, 60, 75)),
  target_muscle_groups text[] not null default '{}',
  reason text,
  generated_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz
);
create index if not exists workouts_user_completed_idx
  on public.workouts (user_id, completed_at desc nulls last);

-- -----------------------------------------------------------------------------
-- workout_exercises — exercises planned for a given workout.
-- -----------------------------------------------------------------------------
create table if not exists public.workout_exercises (
  id uuid primary key default gen_random_uuid(),
  workout_id uuid not null references public.workouts(id) on delete cascade,
  exercise_id text not null references public.exercises(id),
  order_index smallint not null,
  notes text
);
create index if not exists workout_exercises_workout_idx
  on public.workout_exercises (workout_id, order_index);

-- -----------------------------------------------------------------------------
-- workout_sets — planned + actual reps/weights per set.
-- -----------------------------------------------------------------------------
create table if not exists public.workout_sets (
  id uuid primary key default gen_random_uuid(),
  workout_exercise_id uuid not null references public.workout_exercises(id) on delete cascade,
  set_index smallint not null,
  target_reps_min smallint not null,
  target_reps_max smallint not null,
  recommended_weight_lbs numeric(6,1),
  rest_seconds integer not null,
  actual_reps smallint,
  actual_weight_lbs numeric(6,1),
  completed boolean not null default false
);
create index if not exists workout_sets_exercise_idx
  on public.workout_sets (workout_exercise_id, set_index);

-- -----------------------------------------------------------------------------
-- muscle_group_recovery — running recovery state per user/muscle.
-- -----------------------------------------------------------------------------
create table if not exists public.muscle_group_recovery (
  user_id uuid not null references public.profiles(id) on delete cascade,
  muscle_group text not null,
  last_trained_at timestamptz,
  recent_hard_sets smallint not null default 0,
  average_fatigue_score numeric(4,2) not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id, muscle_group)
);

-- -----------------------------------------------------------------------------
-- exercise_performance_history — per-set history for progression decisions.
-- -----------------------------------------------------------------------------
create table if not exists public.exercise_performance_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  exercise_id text not null references public.exercises(id),
  performed_at timestamptz not null default now(),
  weight_lbs numeric(6,1),
  reps smallint,
  set_index smallint not null,
  hit_top_of_range boolean not null default false,
  missed_target boolean not null default false
);
create index if not exists eph_user_exercise_time_idx
  on public.exercise_performance_history (user_id, exercise_id, performed_at desc);

-- =============================================================================
-- Row-Level Security
-- =============================================================================
alter table public.profiles                      enable row level security;
alter table public.exercises                     enable row level security;
alter table public.user_exercise_pool            enable row level security;
alter table public.user_exercise_maxes           enable row level security;
alter table public.workouts                      enable row level security;
alter table public.workout_exercises             enable row level security;
alter table public.workout_sets                  enable row level security;
alter table public.muscle_group_recovery         enable row level security;
alter table public.exercise_performance_history  enable row level security;

-- profiles: each user can read/update only their own profile.
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
  for select using (id = auth.uid());

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

-- exercises: any authenticated user can read; nobody writes via API.
drop policy if exists "exercises_read_all" on public.exercises;
create policy "exercises_read_all" on public.exercises
  for select to authenticated using (true);

-- user_exercise_pool: full CRUD on own rows only.
drop policy if exists "uep_all_own" on public.user_exercise_pool;
create policy "uep_all_own" on public.user_exercise_pool
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- user_exercise_maxes: full CRUD on own rows only.
drop policy if exists "uem_all_own" on public.user_exercise_maxes;
create policy "uem_all_own" on public.user_exercise_maxes
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- workouts: full CRUD on own rows only.
drop policy if exists "workouts_all_own" on public.workouts;
create policy "workouts_all_own" on public.workouts
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- workout_exercises: gated by ownership of the parent workout.
drop policy if exists "we_all_own" on public.workout_exercises;
create policy "we_all_own" on public.workout_exercises
  for all using (
    exists (
      select 1 from public.workouts w
      where w.id = workout_exercises.workout_id and w.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.workouts w
      where w.id = workout_exercises.workout_id and w.user_id = auth.uid()
    )
  );

-- workout_sets: gated by ownership of the parent workout (via exercise).
drop policy if exists "ws_all_own" on public.workout_sets;
create policy "ws_all_own" on public.workout_sets
  for all using (
    exists (
      select 1
      from public.workout_exercises we
      join public.workouts w on w.id = we.workout_id
      where we.id = workout_sets.workout_exercise_id and w.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.workout_exercises we
      join public.workouts w on w.id = we.workout_id
      where we.id = workout_sets.workout_exercise_id and w.user_id = auth.uid()
    )
  );

-- muscle_group_recovery: full CRUD on own rows.
drop policy if exists "mgr_all_own" on public.muscle_group_recovery;
create policy "mgr_all_own" on public.muscle_group_recovery
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- exercise_performance_history: full CRUD on own rows.
drop policy if exists "eph_all_own" on public.exercise_performance_history;
create policy "eph_all_own" on public.exercise_performance_history
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
