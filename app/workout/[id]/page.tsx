import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

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
      "id, target_muscle_groups, reason, available_minutes, workout_mode, generated_at, completed_at"
    )
    .eq("id", id)
    .maybeSingle();

  if (!workout) redirect("/dashboard?error=workout_not_found");

  return (
    <main className="mx-auto w-full max-w-md px-4 py-8">
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
        <p className="mt-1 text-sm text-zinc-500">
          {workout.available_minutes} min · {workout.workout_mode}
        </p>
      </header>

      <div className="rounded-lg border border-zinc-200 bg-white p-4 text-sm dark:border-zinc-800 dark:bg-zinc-950">
        <p className="font-medium">Workout screen coming next</p>
        <p className="mt-1 text-zinc-500">
          {workout.reason}
        </p>
        <p className="mt-3 text-xs text-zinc-400">Workout ID: {workout.id}</p>
      </div>
    </main>
  );
}
