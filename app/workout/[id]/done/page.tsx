import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function WorkoutDonePage({
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
      "id, target_muscle_groups, completed_at, available_minutes, workout_mode"
    )
    .eq("id", id)
    .maybeSingle();
  if (!workout) redirect("/dashboard");

  const { count: completedCount } = await supabase
    .from("workout_sets")
    .select("id, workout_exercise:workout_exercises!inner ( workout_id )", {
      count: "exact",
      head: true,
    })
    .eq("workout_exercise.workout_id", id)
    .eq("completed", true);

  return (
    <main className="mx-auto w-full max-w-md px-4 py-10 text-center">
      <p className="text-5xl">💪</p>
      <h1 className="mt-4 text-2xl font-semibold tracking-tight">
        Workout complete
      </h1>
      <p className="mt-2 text-sm text-zinc-500">
        {workout.target_muscle_groups.join(" + ")} ·{" "}
        {completedCount ?? 0} sets logged
      </p>

      <div className="mt-8 space-y-3">
        <Link
          href="/dashboard"
          className="block w-full rounded-md bg-zinc-900 px-4 py-3 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
        >
          Back to dashboard
        </Link>
        <Link
          href="/history"
          className="block w-full rounded-md border border-zinc-300 px-4 py-3 text-sm font-medium hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
        >
          See history
        </Link>
      </div>
    </main>
  );
}
