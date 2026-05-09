import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function HistoryPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: workouts } = await supabase
    .from("workouts")
    .select(
      `
      id, target_muscle_groups, available_minutes, workout_mode,
      generated_at, completed_at,
      exercises:workout_exercises (
        id, exercise:exercises ( exercise_name ),
        sets:workout_sets ( actual_reps, actual_weight_lbs, completed )
      )
    `
    )
    .eq("user_id", user.id)
    .not("completed_at", "is", null)
    .order("completed_at", { ascending: false })
    .limit(50);

  const list = workouts ?? [];

  return (
    <main className="mx-auto w-full max-w-md px-4 py-8">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">History</h1>
          <p className="mt-1 text-sm text-zinc-500">
            {list.length === 0
              ? "Nothing logged yet — finish a workout to start your history."
              : `${list.length} completed workout${list.length === 1 ? "" : "s"}`}
          </p>
        </div>
        <Link
          href="/dashboard"
          className="text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
        >
          Dashboard
        </Link>
      </header>

      {list.length === 0 ? (
        <div className="rounded-lg border border-dashed border-zinc-300 px-4 py-10 text-center text-sm text-zinc-500 dark:border-zinc-700">
          <p>No completed workouts yet.</p>
          <Link
            href="/dashboard"
            className="mt-3 inline-block text-zinc-900 underline dark:text-zinc-100"
          >
            Generate one →
          </Link>
        </div>
      ) : (
        <ol className="space-y-3">
          {list.map((w) => {
            const completedAt = new Date(w.completed_at!);
            const dateStr = completedAt.toLocaleDateString(undefined, {
              weekday: "short",
              month: "short",
              day: "numeric",
            });
            const totalSets = (w.exercises ?? []).reduce(
              (sum, we) => sum + ((we.sets as { completed: boolean }[]) ?? []).filter((s) => s.completed).length,
              0
            );
            const exerciseList = ((w.exercises ?? []) as Array<{ exercise: unknown }>)
              .map((we) => {
                const ex = Array.isArray(we.exercise) ? we.exercise[0] : we.exercise;
                return (ex as { exercise_name?: string } | undefined)?.exercise_name;
              })
              .filter((n): n is string => Boolean(n));

            return (
              <li
                key={w.id}
                className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950"
              >
                <div className="flex items-baseline justify-between">
                  <p className="text-sm font-medium">{dateStr}</p>
                  <p className="text-xs text-zinc-500">
                    {w.available_minutes} min · {w.workout_mode}
                  </p>
                </div>
                <p className="mt-1 text-base font-semibold">
                  {(w.target_muscle_groups as string[]).join(" + ")}
                </p>
                <p className="mt-1 text-xs text-zinc-500">
                  {totalSets} set{totalSets === 1 ? "" : "s"} ·{" "}
                  {exerciseList.length} exercise
                  {exerciseList.length === 1 ? "" : "s"}
                </p>
                {exerciseList.length > 0 && (
                  <p className="mt-2 text-xs text-zinc-600 dark:text-zinc-400">
                    {exerciseList.slice(0, 4).join(", ")}
                    {exerciseList.length > 4
                      ? `, +${exerciseList.length - 4} more`
                      : ""}
                  </p>
                )}
                <Link
                  href={`/history/${w.id}`}
                  className="mt-3 inline-block text-xs font-medium text-zinc-900 hover:underline dark:text-zinc-100"
                >
                  Details →
                </Link>
              </li>
            );
          })}
        </ol>
      )}
    </main>
  );
}
