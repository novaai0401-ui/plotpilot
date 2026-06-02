import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { createTeamInviteToken } from "@/lib/auth/team-invite-token";
import { sendEmail } from "@/lib/email/resend";
import { checkRateLimit, persistRateLimitDenial } from "@/lib/rate-limit";

/**
 * POST /api/team/invite
 *
 * Broker_admin invites a colleague (broker_agent) by email.
 * - Generates a signed token (HMAC, expires in 14 days, carries orgId+role+email).
 * - Emails a signup link.
 *
 * No DB row needed — the token is self-contained.
 */
export async function POST(req: NextRequest) {
  const user = await requireUser(["broker_admin", "super_admin"]);
  const body = await req.json().catch(() => ({}));
  const email = String(body.email || "").trim().toLowerCase();
  const name = String(body.name || "").trim();
  const role = body.role === "broker_admin" ? "broker_admin" : "broker_agent";

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Valid email required" }, { status: 400 });
  }
  if (!name) {
    return NextResponse.json({ error: "Name required" }, { status: 400 });
  }

  // Per-org cap: 20 team-invite sends per hour. Prevents a compromised
  // broker_admin from spraying mass invites (and us from paying for the
  // Resend usage). Captured to AnalyticsEvent so super_admin can spot
  // abuse from /admin/rate-limits.
  const rl = await checkRateLimit(user.orgId, {
    prefix: "team_invite_send",
    max: 20,
    windowMs: 60 * 60 * 1000,
  });
  if (!rl.success) {
    await persistRateLimitDenial(user.orgId, "team_invite_send", {
      remaining: rl.remaining,
      resetAt: rl.resetAt,
    });
    return NextResponse.json(
      {
        error: `Too many team invites this hour (limit ${rl.limit}). Try again after ${new Date(
          rl.resetAt
        ).toLocaleTimeString()}.`,
        retryAt: rl.resetAt,
      },
      { status: 429 }
    );
  }

  // Don't invite someone who's already in your org
  const existing = await prisma.user.findFirst({
    where: { orgId: user.orgId, email },
  });
  if (existing) {
    return NextResponse.json(
      { error: "That email is already in your organization." },
      { status: 409 }
    );
  }

  const token = await createTeamInviteToken({
    orgId: user.orgId,
    email,
    name,
    role,
    expiresInDays: 14,
  });
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const link = `${appUrl}/signup?team=${token}`;

  const org = await prisma.organization.findUnique({ where: { id: user.orgId } });
  const orgName = org?.name || "your team";
  const inviterName = user.name;
  const roleLabel = role === "broker_admin" ? "Admin" : "Agent";

  const html = `<!doctype html>
<html><body style="margin:0;padding:0;font-family:system-ui,sans-serif;background:#f6f8f7;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f8f7;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;border:1px solid #e5e7eb;">
        <tr><td style="padding:28px 28px 8px;">
          <div style="font-size:13px;color:#0f766e;font-weight:700;">PlotBroker · team invite</div>
          <h1 style="margin:6px 0 0;font-size:22px;line-height:1.3;">${escapeHtml(inviterName)} invited you to ${escapeHtml(orgName)}</h1>
          <p style="margin:12px 0 0;color:#374151;font-size:14px;line-height:1.55;">
            You've been invited as <strong>${roleLabel}</strong>. Click below to create your account — the email is pre-set to <code style="background:#f1f5f9;padding:2px 4px;border-radius:3px;">${escapeHtml(email)}</code>.
          </p>
        </td></tr>
        <tr><td style="padding:18px 28px 28px;">
          <a href="${escapeAttr(link)}" style="display:inline-block;background:#0f766e;color:#ffffff;padding:12px 22px;border-radius:6px;text-decoration:none;font-weight:600;font-size:15px;">
            Accept invite →
          </a>
          <p style="margin:18px 0 0;color:#6b7280;font-size:12px;">
            Link expires in 14 days. If you weren't expecting this, ignore the email — no account is created until you accept.
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;

  const text = `Hi ${name},\n\n${inviterName} invited you to ${orgName} as ${roleLabel}.\n\nAccept the invite: ${link}\n\nLink expires in 14 days.`;

  const emailResult = await sendEmail({
    to: email,
    subject: `${inviterName} invited you to ${orgName} on PlotBroker`,
    html,
    text,
  });

  // Log analytics event
  await prisma.analyticsEvent.create({
    data: {
      orgId: user.orgId,
      type: "team.invite.sent",
      actorId: user.id,
      metadata: { invitedEmail: email, role, emailSent: emailResult.ok },
    },
  });

  return NextResponse.json({
    ok: true,
    email,
    role,
    link, // returned so the inviter can copy-share if email failed (e.g. no Resend key in dev)
    emailDelivered: emailResult.ok,
    emailError: emailResult.ok ? null : (emailResult as any).error,
  });
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!)
  );
}
function escapeAttr(s: string): string {
  return escapeHtml(s);
}
