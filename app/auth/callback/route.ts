import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/auth/supabase-server";
import { provisionUser, pendingProvisionFromMetadata } from "@/lib/auth/provision";

/**
 * Supabase email-confirmation redirect target.
 *
 * Flow:
 *   1. User signs up with email confirmation enabled in Supabase.
 *   2. Supabase sends email with a link like https://<app>/auth/callback?code=<one-time>
 *   3. User clicks it. This route exchanges the code for a session (sets cookies),
 *      reads the metadata we stashed at signup time, and provisions the User+Org rows.
 *   4. Redirects to /dashboard (or /portal if they joined via invite).
 *
 * Also handles existing-user logins where no provision is needed (idempotent).
 */
export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const errorParam = req.nextUrl.searchParams.get("error");
  const next = req.nextUrl.searchParams.get("next") || null;

  if (errorParam) {
    const u = req.nextUrl.clone();
    u.pathname = "/login";
    u.search = `?reason=${encodeURIComponent(errorParam)}`;
    return NextResponse.redirect(u);
  }
  if (!code) {
    const u = req.nextUrl.clone();
    u.pathname = "/login";
    u.search = "?reason=missing_code";
    return NextResponse.redirect(u);
  }

  const supabase = createSupabaseServerClient();
  if (!supabase) {
    const u = req.nextUrl.clone();
    u.pathname = "/login";
    u.search = "?reason=supabase_not_configured";
    return NextResponse.redirect(u);
  }

  const { error: exchErr } = await supabase.auth.exchangeCodeForSession(code);
  if (exchErr) {
    console.error("[auth/callback] exchange failed:", exchErr.message);
    const u = req.nextUrl.clone();
    u.pathname = "/login";
    u.search = `?reason=exchange_failed`;
    return NextResponse.redirect(u);
  }

  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();
  if (!authUser) {
    const u = req.nextUrl.clone();
    u.pathname = "/login";
    return NextResponse.redirect(u);
  }

  // Provision if needed (idempotent — returns existing user if already provisioned).
  const fromMeta = pendingProvisionFromMetadata(authUser.user_metadata);
  const result = await provisionUser({
    authId: authUser.id,
    authEmail: authUser.email,
    orgName: fromMeta.orgName || null,
    name: fromMeta.name || authUser.email?.split("@")[0] || "User",
    phone: fromMeta.phone || "",
    email: authUser.email,
    inviteToken: fromMeta.inviteToken || null,
    teamToken: (fromMeta as any).teamToken || null,
  });

  // If provision failed because the metadata was missing/invalid, send the user to a
  // recovery page where they can complete the missing info.
  if (!result.ok) {
    const u = req.nextUrl.clone();
    u.pathname = "/auth/complete";
    u.search = `?reason=${encodeURIComponent(result.error)}`;
    return NextResponse.redirect(u);
  }

  const destination =
    next || (result.role === "client" ? "/portal" : "/dashboard");
  const u = req.nextUrl.clone();
  u.pathname = destination;
  u.search = "";
  return NextResponse.redirect(u);
}
