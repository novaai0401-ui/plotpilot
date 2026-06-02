import { prisma } from "@/lib/db/prisma";
import { formatPhone } from "@/lib/utils";
import type { Prisma } from "@prisma/client";
import { verifyTeamInviteToken } from "./team-invite-token";
import { plotSeeds, clientSeeds } from "@/lib/onboarding/demo-data";

export type ProvisionInput = {
  authId: string;
  authEmail?: string | null;
  orgName?: string | null;
  name: string;
  phone: string;
  email?: string | null;
  /** Client invite token (DB-backed Invitation row) */
  inviteToken?: string | null;
  /** Team invite token (signed JWT-style; carries orgId + role + email) */
  teamToken?: string | null;
};

export type ProvisionResult =
  | { ok: true; userId: string; orgId: string; role: "client" | "broker_admin" | "broker_agent"; alreadyProvisioned?: boolean }
  | { ok: false; error: string; status: number };

/**
 * Shared provisioning logic used by:
 *   - POST /api/auth/provision (called immediately after signUp when session is live)
 *   - GET  /auth/callback     (called after email confirmation; reads metadata stashed at signup)
 *
 * Idempotent: if a User row already exists for this authId, returns it unchanged.
 */
export async function provisionUser(input: ProvisionInput): Promise<ProvisionResult> {
  const { authId, authEmail, inviteToken } = input;

  // Idempotency — never re-provision
  const existing = await prisma.user.findUnique({ where: { authId } });
  if (existing) {
    return {
      ok: true,
      userId: existing.id,
      orgId: existing.orgId,
      role: existing.role === "client" ? "client" : "broker_admin",
      alreadyProvisioned: true,
    };
  }

  if (!input.name || !input.phone) {
    return { ok: false, error: "Missing name or phone", status: 400 };
  }
  const phone = formatPhone(input.phone);
  const email = input.email || authEmail || null;

  // Branch 0: joining via team invite link → become broker_admin/broker_agent of the inviting org
  if (input.teamToken) {
    const tv = await verifyTeamInviteToken(input.teamToken);
    if (!tv.ok) {
      return { ok: false, error: `Team invite: ${tv.error}`, status: 400 };
    }
    // Email in token must match the authenticated email (prevents one invite being used for another account)
    if (email && tv.payload.email.toLowerCase() !== email.toLowerCase()) {
      return {
        ok: false,
        error: `This invite was issued to ${tv.payload.email}, but you're signed in as ${email}.`,
        status: 403,
      };
    }
    const user = await prisma.$transaction(async (tx) => {
      const u = await tx.user.create({
        data: {
          authId,
          orgId: tv.payload.orgId,
          role: tv.payload.role,
          name: input.name,
          email,
          phone,
        },
      });
      await tx.analyticsEvent.create({
        data: {
          orgId: tv.payload.orgId,
          type: "team.invite.accepted",
          actorId: u.id,
          metadata: { jti: tv.payload.jti, role: tv.payload.role } as Prisma.InputJsonValue,
        },
      });
      return u;
    });
    return { ok: true, userId: user.id, orgId: user.orgId, role: tv.payload.role };
  }

  // Branch 1: joining via client invite link → become a client of the inviting org
  if (inviteToken) {
    const invite = await prisma.invitation.findUnique({ where: { token: inviteToken } });
    if (!invite || invite.status !== "pending" || invite.expiresAt < new Date()) {
      return { ok: false, error: "Invalid or expired invite", status: 400 };
    }

    const user = await prisma.$transaction(async (tx) => {
      const u = await tx.user.create({
        data: {
          authId,
          orgId: invite.orgId,
          role: "client",
          name: input.name,
          email,
          phone,
          ownerAgentId: invite.sentById,
        },
      });
      await tx.invitation.update({
        where: { id: invite.id },
        data: { status: "accepted", acceptedAt: new Date() },
      });
      await tx.analyticsEvent.create({
        data: {
          orgId: invite.orgId,
          type: "invitation.accepted",
          actorId: u.id,
          metadata: { invitationId: invite.id } as Prisma.InputJsonValue,
        },
      });
      return u;
    });

    return { ok: true, userId: user.id, orgId: user.orgId, role: "client" };
  }

  // Branch 2: brand-new org + broker_admin
  if (!input.orgName) {
    return { ok: false, error: "Missing orgName (and no inviteToken either)", status: 400 };
  }
  const slugBase = input.orgName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
  const slug = `${slugBase}-${Math.random().toString(36).slice(2, 6)}`;

  const created = await prisma.$transaction(async (tx) => {
    const org = await tx.organization.create({
      data: {
        name: input.orgName!,
        slug,
        whatsappConfig: { create: {} },
      },
    });
    const user = await tx.user.create({
      data: {
        authId,
        orgId: org.id,
        role: "broker_admin",
        name: input.name,
        email,
        phone,
      },
    });
    await tx.analyticsEvent.create({
      data: { orgId: org.id, type: "org.created", actorId: user.id },
    });

    // Seed demo data — only for brand-new orgs (not invite-driven signups).
    // All rows prefixed "Demo:" so the broker can spot + delete via the
    // normal UI when they're ready to add real listings.
    await tx.plot.createMany({ data: plotSeeds(org.id, user.id) });
    await tx.user.createMany({ data: clientSeeds(org.id, user.id) });

    // Schedule one visit so the dashboard "upcoming" tile isn't empty either.
    const firstPlot = await tx.plot.findFirst({
      where: { orgId: org.id },
      select: { id: true },
    });
    const firstDemoClient = await tx.user.findFirst({
      where: { orgId: org.id, role: "client" },
      select: { id: true },
    });
    if (firstPlot && firstDemoClient) {
      await tx.visit.create({
        data: {
          orgId: org.id,
          plotId: firstPlot.id,
          clientId: firstDemoClient.id,
          agentId: user.id,
          scheduledAt: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000), // 2 days out
          status: "scheduled",
          notes: "Demo visit — feel free to cancel once you're set up.",
        },
      });
    }

    await tx.analyticsEvent.create({
      data: { orgId: org.id, type: "org.demo_seeded", actorId: user.id },
    });

    return { org, user };
  });

  return { ok: true, userId: created.user.id, orgId: created.org.id, role: "broker_admin" };
}

/**
 * Pull the fields we stashed in Supabase user_metadata at signup time
 * (so we can provision after email confirmation when the form data is gone).
 */
export function pendingProvisionFromMetadata(meta: any): Partial<ProvisionInput> {
  if (!meta || typeof meta !== "object") return {};
  return {
    orgName: typeof meta.pending_orgName === "string" ? meta.pending_orgName : null,
    name: typeof meta.pending_name === "string" ? meta.pending_name : "",
    phone: typeof meta.pending_phone === "string" ? meta.pending_phone : "",
    inviteToken: typeof meta.pending_inviteToken === "string" ? meta.pending_inviteToken : null,
    teamToken: typeof meta.pending_teamToken === "string" ? meta.pending_teamToken : null,
  };
}
