import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { completeWorkoutAction } from "./actions";

interface SetView {
  id: string;
  set_index: number;
  target_reps_min: number;
  target_reps_max: number;
  recommended_weight_lbs: number | null;
  rest_seconds: number;
  actual_reps: number | null;
  actual_weight_lbs: number | null;
  completed: boolean;
}

interface ExerciseView {
  id: string;
  exercise_id: string;
  order_index: number;
  notes: string | null;
  exercise_name: string;
  primary_muscle_group: string;
  equipment_type: string;
  sets: SetView[];
}

export default async function WorkoutPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: workout } = await supabase
    .from("workouts")
    .select(
      "id, target_muscle_groups, reason, available_minutes, workout_mode, completed_at"
    )
    .eq("id", id)
    .maybeSingle();
  if (!workout) redirect("/dashboard?error=workout_not_found");
  if (workout.completed_at) redirect(`/workout/${id}/done`);

  const { data: weRows } = await supabase
    .from("workout_exercises")
    .select(
      `
      id, exercise_id, order_index, notes,
      exercise:exercises ( exercise_name, primary_muscle_group, equipment_type ),
      sets:workout_sets ( id, set_index, target_reps_min, target_reps_max, recommended_weight_lbs, rest_seconds, actual_reps, actual_weight_lbs, completed )
    `
    )
    .eq("workout_id", id)
    .order("order_index", { ascending: true });

  const exercises: ExerciseView[] = (weRows ?? []).map((row) => {
    const ex = Array.isArray(row.exercise) ? row.exercise[0] : row.exercise;
    const sets: SetView[] = (row.sets ?? [])
      .map((s) => s as SetView)
      .sort((a, b) => a.set_index - b.set_index);
    return {
      id: row.id,
      exercise_id: row.exercise_id,
      order_index: row.order_index,
      notes: row.notes,
      exercise_name: ex?.exercise_name ?? "Unknown exercise",
      primary_muscle_group: ex?.primary_muscle_group ?? "",
      equipment_type: ex?.equipment_type ?? "",
      sets,
    };
  });

  return (
    <main className="mx-auto w-full max-w-md px-4 py-6 pb-32">
      <header className="mb-4">
        <Link
          href="/dashboard"
          className="text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
        >
          ← Dashboard
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">
          {workout.target_muscle_groups.join(" + ")}
        </h1>
        <p className="mt-1 text-xs text-zinc-500">
          {workout.available_minutes} min · {workout.workout_mode} · {exercises.length} exercises
        </p>
      </header>

      <form action={completeWorkoutAction}>
        <input type="hidden" name="workout_id" value={id} />

        <ol className="space-y-4">
          {exercises.map((ex, idx) => (
            <li
              key={ex.id}
              className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950"
            >
              <header className="mb-3">
                <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">
                  {idx + 1} of {exercises.length} · {ex.primary_muscle_group}
                </p>
                <h2 className="mt-0.5 text-lg font-semibold">
                  {ex.exercise_name}
                </h2>
                <p className="text-xs text-zinc-500">
                  {ex.equipment_type} · Rest{" "}
                  {Math.round((ex.sets[0]?.rest_seconds ?? 0) / 60)} min between sets
                </p>
              </header>

              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs font-medium uppercase tracking-wider text-zinc-500">
                    <th className="w-8 py-1.5">#</th>
                    <th className="py-1.5">Reps</th>
                    <th className="py-1.5">Weight</th>
                    <th className="w-12 py-1.5 text-center">Done</th>
                  </tr>
                </thead>
                <tbody>
                  {ex.sets.map((s) => (
                    <tr
                      key={s.id}
                      className="border-t border-zinc-100 dark:border-zinc-900"
                    >
                      <td className="py-2 text-zinc-500">{s.set_index + 1}</td>
                      <td className="py-2">
                        <input
                          type="number"
                          name={`set_${s.id}_reps`}
                          inputMode="numeric"
                          min={0}
                          defaultValue={s.actual_reps ?? ""}
                          placeholder={`${s.target_reps_min}-${s.target_reps_max}`}
                          className="w-20 rounded-md border border-zinc-300 px-2 py-1.5 text-base focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900 dark:border-zinc-700 dark:bg-zinc-950"
                        />
                      </td>
                      <td className="py-2">
                        <input
                          type="number"
                          name={`set_${s.id}_weight`}
                          inputMode="decimal"
                          step={5}
                          min={0}
                          defaultValue={
                            s.actual_weight_lbs ??
                            s.recommended_weight_lbs ??
                            ""
                          }
                          placeholder={
                            s.recommended_weight_lbs != null
                              ? String(s.recommended_weight_lbs)
                              : "—"
                          }
                          className="w-20 rounded-md border border-zinc-300 px-2 py-1.5 text-base focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900 dark:border-zinc-700 dark:bg-zinc-950"
                        />
                      </td>
                      <td className="py-2 text-center">
                        <input
                          type="checkbox"
                          name={`set_${s.id}_completed`}
                          defaultChecked={s.completed}
                          className="h-5 w-5 rounded border-zinc-300 dark:border-zinc-700"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {ex.notes && (
                <p className="mt-3 text-xs text-zinc-500">{ex.notes}</p>
              )}
            </li>
          ))}
        </ol>

        <div className="fixed inset-x-0 bottom-0 border-t border-zinc-200 bg-white/95 px-4 py-3 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/95">
          <div className="mx-auto w-full max-w-md">
            <button
              type="submit"
              className="w-full rounded-md bg-zinc-900 px-4 py-3 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
            >
              Complete workout
            </button>
          </div>
        </div>
      </form>
    </main>
  );
}
