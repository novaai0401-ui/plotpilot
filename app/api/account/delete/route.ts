import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { prisma } from "@/lib/db/prisma";
import { requireUser } from "@/lib/auth/session";
import { revokeSessionByCookie } from "@/lib/auth/native/session-cookie";

export const dynamic = "force-dynamic";

/**
 * POST /api/account/delete
 *
 * Self-serve account + organization deletion. Required for DPDPA (India) and
 * GDPR compliance once we have non-trial users.
 *
 * Required body: { confirmSlug: string }
 *   The caller must echo back their org's slug verbatim. Prevents accidental
 *   deletion via CSRF or clickjacking — even if both protections fail upstream,
 *   the attacker has to know (and POST) the slug.
 *
 * Authorization: broker_admin only. Agents and clients cannot delete the org.
 *
 * Effects (in this order, so a failure mid-way leaves the auth user intact
 * but the data partially gone — preferable to the inverse, which would
 * orphan a session pointing at a missing org):
 *
 *   1. Verify confirmSlug matches.
 *   2. Audit: log a structured 'account.deleted' event to stderr (also a Sentry
 *      breadcrumb once #95 lands). Survives the Prisma cascade because the
 *      AnalyticsEvent rows themselves get wiped.
 *   3. Prisma cascade: delete Organization. Schema has onDelete: Cascade on
 *      every child relation, so this single statement wipes Users, Plots,
 *      Visits, Messages, BuildingDesigns, Invitations, etc.
 *   4. Supabase Auth: delete the *caller's* auth user. (Other team members
 *      become orphaned auth accounts with no User row — handled by /login
 *      redirect to /signup since getSessionUser() returns null for orphans.)
 *   5. Clear the session cookie so the response returns the user to /signup.
 *
 * What's intentionally NOT deleted:
 *   - Webhook event log rows older than 30 days are kept org-anonymous for
 *     replay-attack analysis. The schema doesn't link WebhookEvent → Org so
 *     these survive automatically.
 *   - Audit log of THIS deletion (stderr trail / Sentry).
 */
export async function POST(req: NextRequest) {
  const user = await requireUser(["broker_admin"]);
  const body = await req.json().catch(() => ({}));
  const confirmSlug = String(body?.confirmSlug || "").trim();

  const org = await prisma.organization.findUnique({
    where: { id: user.orgId },
    select: {
      id: true,
      slug: true,
      name: true,
      _count: { select: { users: true, plots: true, visits: true } },
    },
  });
  if (!org) {
    // Already gone — return ok so the client redirects.
    return NextResponse.json({ ok: true, alreadyDeleted: true });
  }

  if (confirmSlug !== org.slug) {
    return NextResponse.json(
      {
        error: "Confirmation slug doesn't match. Type the exact slug shown on the page.",
      },
      { status: 400 }
    );
  }

  // ── Audit ────────────────────────────────────────────────────────────────
  // Structured stderr line. Stays in the deploy's log retention even after
  // the AnalyticsEvent rows get cascade-deleted. Once Sentry is wired (#95),
  // this also becomes a captured breadcrumb / message.
  const auditLine = {
    audit: "account.deleted",
    at: new Date().toISOString(),
    orgId: org.id,
    orgSlug: org.slug,
    orgName: org.name,
    actorUserId: user.id,
    actorAuthId: user.authId,
    actorEmail: user.email,
    counts: org._count,
    ip:
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("x-real-ip") ||
      null,
    userAgent: req.headers.get("user-agent") || null,
  };
  // eslint-disable-next-line no-console
  console.warn(JSON.stringify(auditLine));
  // Also persist to Sentry — survives even if log retention rotates the
  // structured stderr line out before an audit request lands.
  Sentry.captureMessage("account.deleted", {
    level: "warning",
    tags: { audit: "account.deleted", orgId: org.id },
    extra: auditLine,
  });

  // ── Cascade-delete the org ────────────────────────────────────────────────
  // Schema has onDelete: Cascade on every Org-child relation. If you're
  // adding a new tenant table, set onDelete: Cascade on its orgId relation
  // OR add an explicit delete here — the integration test suite will catch
  // an orphan if you forget.
  await prisma.organization.delete({ where: { id: org.id } });

  // ── Sign out: revoke the native session + clear the cookie ───────────────
  // AuthCredential + Session + EmailVerification + PasswordResetToken rows
  // cascaded with the User row when we deleted the Organization above.
  await revokeSessionByCookie();

  return NextResponse.json({ ok: true });
}
