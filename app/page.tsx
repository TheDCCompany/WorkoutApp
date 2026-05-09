import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Proxy guarantees we have a user here, but be defensive.
  if (!user) redirect("/login");

  // Send users who haven't onboarded straight into the onboarding flow.
  const { data: profile } = await supabase
    .from("profiles")
    .select("onboarded_at")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile?.onboarded_at) {
    redirect("/onboarding");
  }

  redirect("/dashboard");
}
