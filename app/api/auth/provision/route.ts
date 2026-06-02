import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/auth/supabase-server";
import { provisionUser, pendingProvisionFromMetadata } from "@/lib/auth/provision";

/**
 * Provision a new user after Supabase sign-up.
 *
 * Two callers:
 *   1. Browser, immediately after signUp() when email confirmation is OFF (session is live).
 *   2. /auth/callback after email confirmation — but that route calls provisionUser() directly,
 *      not this HTTP endpoint, so this is only the browser path.
 *
 * Body fields (orgName, name, phone, email, inviteToken) are optional. If missing, we fall back
 * to Supabase user_metadata that we stash at signup time (see signup page → options.data).
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = createSupabaseServerClient();
    if (!supabase) {
      return NextResponse.json({ error: "Supabase not configured on server" }, { status: 503 });
    }
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser();
    if (!authUser) {
      return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const fromMeta = pendingProvisionFromMetadata(authUser.user_metadata);

    const result = await provisionUser({
      authId: authUser.id,
      authEmail: authUser.email,
      orgName: body.orgName || fromMeta.orgName || null,
      name: body.name || fromMeta.name || "",
      phone: body.phone || fromMeta.phone || "",
      email: body.email || authUser.email || null,
      inviteToken: body.inviteToken || fromMeta.inviteToken || null,
    });

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    return NextResponse.json({ user: { id: result.userId, orgId: result.orgId, role: result.role } });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ error: e.message || "Server error" }, { status: 500 });
  }
}
