import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Handles the email-confirmation redirect from Supabase. After the user clicks
 * the link in their email, Supabase appends a `code` query param and bounces
 * to this URL. We exchange the code for a session, then send them to
 * onboarding (or the dashboard if they've already onboarded).
 */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");

  if (!code) {
    return NextResponse.redirect(new URL("/login?error=missing_code", url));
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(
      new URL(`/login?error=${encodeURIComponent(error.message)}`, url)
    );
  }

  return NextResponse.redirect(new URL("/onboarding", url));
}
