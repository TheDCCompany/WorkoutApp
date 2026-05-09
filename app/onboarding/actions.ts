"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function savePoolAction(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const selectedIds = formData.getAll("exercise_id").map(String);

  // Replace the user's pool. Delete then insert is fine for the MVP — pool
  // sizes are tiny (~20-50 rows) and this happens at most once or twice.
  await supabase.from("user_exercise_pool").delete().eq("user_id", user.id);

  if (selectedIds.length > 0) {
    const rows = selectedIds.map((exercise_id) => ({
      user_id: user.id,
      exercise_id,
    }));
    const { error } = await supabase.from("user_exercise_pool").insert(rows);
    if (error) {
      redirect(`/onboarding?error=${encodeURIComponent(error.message)}`);
    }
  }

  redirect("/onboarding/maxes");
}

export async function saveMaxesAction(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const updates: { user_id: string; exercise_id: string; one_rep_max_lbs: number }[] = [];
  const deletes: string[] = [];

  for (const [key, raw] of formData.entries()) {
    if (!key.startsWith("max_")) continue;
    const exerciseId = key.slice("max_".length);
    const value = String(raw).trim();
    if (!value) {
      deletes.push(exerciseId);
      continue;
    }
    const num = Number(value);
    if (Number.isFinite(num) && num > 0) {
      updates.push({
        user_id: user.id,
        exercise_id: exerciseId,
        one_rep_max_lbs: num,
      });
    }
  }

  if (deletes.length > 0) {
    await supabase
      .from("user_exercise_maxes")
      .delete()
      .eq("user_id", user.id)
      .in("exercise_id", deletes);
  }

  if (updates.length > 0) {
    const { error } = await supabase
      .from("user_exercise_maxes")
      .upsert(updates, { onConflict: "user_id,exercise_id" });
    if (error) {
      redirect(`/onboarding/maxes?error=${encodeURIComponent(error.message)}`);
    }
  }

  // Mark onboarded.
  await supabase
    .from("profiles")
    .update({ onboarded_at: new Date().toISOString() })
    .eq("id", user.id);

  redirect("/dashboard");
}

export async function skipMaxesAction() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  await supabase
    .from("profiles")
    .update({ onboarded_at: new Date().toISOString() })
    .eq("id", user.id);

  redirect("/dashboard");
}
