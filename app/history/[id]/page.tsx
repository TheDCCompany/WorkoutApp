import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function HistoryDetailPage({
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
      `
      id, target_muscle_groups, reason, available_minutes, workout_mode,
      generated_at, completed_at, user_id,
      exercises:workout_exercises (
        id, order_index,
        exercise:exercises ( exercise_name, primary_muscle_group, equipment_type ),
        sets:workout_sets ( set_index, target_reps_min, target_reps_max, recommended_weight_lbs, actual_reps, actual_weight_lbs, completed )
      )
    `
    )
    .eq("id", id)
    .maybeSingle();

  if (!workout) redirect("/history");
  if (workout.user_id !== user.id) redirect("/history");

  const completedAt = workout.completed_at
    ? new Date(workout.completed_at)
    : null;

  const exercises = (workout.exercises ?? [])
    .slice()
    .sort((a, b) => a.order_index - b.order_index);

  return (
    <main className="mx-auto w-full max-w-md px-4 py-8">
      <header className="mb-6">
        <Link
          href="/history"
          className="text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
        >
          ← History
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">
          {(workout.target_muscle_groups as string[]).join(" + ")}
        </h1>
        <p className="mt-1 text-xs text-zinc-500">
          {completedAt
            ? completedAt.toLocaleDateString(undefined, {
                weekday: "long",
                month: "long",
                day: "numeric",
                year: "numeric",
              })
            : "(in progress)"}{" "}
          · {workout.available_minutes} min · {workout.workout_mode}
        </p>
        {workout.reason && (
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            {workout.reason}
          </p>
        )}
      </header>

      <ol className="space-y-3">
        {exercises.map((we) => {
          const ex = Array.isArray(we.exercise) ? we.exercise[0] : we.exercise;
          const sets = (we.sets ?? [])
            .slice()
            .sort((a, b) => a.set_index - b.set_index);
          return (
            <li
              key={we.id}
              className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950"
            >
              <h2 className="text-sm font-semibold">
                {(ex as { exercise_name?: string } | undefined)?.exercise_name ?? "Unknown"}
              </h2>
              <p className="text-xs text-zinc-500">
                {(ex as { primary_muscle_group?: string } | undefined)?.primary_muscle_group}{" "}
                · {(ex as { equipment_type?: string } | undefined)?.equipment_type}
              </p>

              <table className="mt-2 w-full text-sm">
                <thead>
                  <tr className="text-left text-xs font-medium uppercase tracking-wider text-zinc-500">
                    <th className="w-8">#</th>
                    <th>Reps</th>
                    <th>Weight</th>
                    <th className="w-12 text-center">Done</th>
                  </tr>
                </thead>
                <tbody>
                  {sets.map((s) => (
                    <tr
                      key={s.set_index}
                      className="border-t border-zinc-100 dark:border-zinc-900"
                    >
                      <td className="py-1.5 text-zinc-500">{s.set_index + 1}</td>
                      <td className="py-1.5">
                        {s.actual_reps ?? "—"}{" "}
                        <span className="text-xs text-zinc-400">
                          ({s.target_reps_min}–{s.target_reps_max})
                        </span>
                      </td>
                      <td className="py-1.5">
                        {s.actual_weight_lbs != null ? `${s.actual_weight_lbs} lbs` : "—"}
                      </td>
                      <td className="py-1.5 text-center">
                        {s.completed ? "✓" : "·"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </li>
          );
        })}
      </ol>
    </main>
  );
}
