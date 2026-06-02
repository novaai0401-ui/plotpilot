import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { prisma } from "@/lib/db/prisma";
import { requireUser, BROKER_ROLES } from "@/lib/auth/session";
import { resolveWhatsAppProvider, renderTemplate } from "@/lib/whatsapp";

/**
 * Claim a public lead. Transactionally:
 *   1. Verifies the design is an unclaimed public_lead.
 *   2. Assigns design.orgId + claimedByOrgId/claimedByAgentId/claimedAt.
 *   3. Creates an Invitation with the lead's contact info (sender = current broker).
 *   4. Optionally fires a WhatsApp invite immediately (body: lead's name + design link + signup link).
 *   5. Emits analytics event 'lead.claimed'.
 *
 * Body: { sendInvite?: boolean }   default true
 *
 * Auth: any broker_admin / broker_agent / super_admin can claim, claim is for their own org.
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await requireUser([...BROKER_ROLES, "super_admin"]);
  const body = await req.json().catch(() => ({}));
  const sendInvite = body.sendInvite !== false;

  const design = await prisma.buildingDesign.findUnique({ where: { id: params.id } });
  if (!design || design.source !== "public_lead") {
    return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  }
  if (design.claimedByOrgId) {
    return NextResponse.json(
      { error: "Already claimed", claimedByOrgId: design.claimedByOrgId },
      { status: 409 }
    );
  }
  if (!design.leadPhone) {
    return NextResponse.json({ error: "Lead has no phone — cannot create invitation" }, { status: 400 });
  }
  if (!user.orgId) {
    return NextResponse.json({ error: "Claimer has no org" }, { status: 400 });
  }

  // Generate Invitation token
  const token = randomBytes(24).toString("base64url");
  const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);

  // Transaction: attach design, create invitation, link them
  const result = await prisma.$transaction(async (tx) => {
    const invite = await tx.invitation.create({
      data: {
        orgId: user.orgId,
        sentById: user.id,
        clientName: design.leadName,
        clientPhone: design.leadPhone!,
        clientEmail: design.leadEmail,
        token,
        expiresAt,
      },
    });
    const updated = await tx.buildingDesign.update({
      where: { id: design.id },
      data: {
        orgId: user.orgId,
        claimedByOrgId: user.orgId,
        claimedByAgentId: user.id,
        claimedAt: new Date(),
        invitationId: invite.id,
      },
    });
    await tx.analyticsEvent.create({
      data: {
        orgId: user.orgId,
        type: "lead.claimed",
        actorId: user.id,
        metadata: { designId: design.id, invitationId: invite.id },
      },
    });
    return { invite, updated };
  });

  // Optional immediate WhatsApp invite to the lead
  let inviteSend: any = null;
  if (sendInvite) {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const inviteUrl = `${appUrl}/signup?invite=${token}`;
    const designUrl = `${appUrl}/designs/${design.id}`;

    const org = await prisma.organization.findUnique({
      where: { id: user.orgId },
      include: { whatsappConfig: true },
    });
    const tmpl =
      org?.whatsappConfig?.inviteTemplate ||
      "Hi {name}, {broker} from {org} can help with your building project. Your design: {design}. Sign up to continue: {link}";

    const renderedBody = renderTemplate(tmpl, {
      name: design.leadName || "there",
      broker: user.name,
      org: org?.name || "",
      design: designUrl,
      link: inviteUrl,
    });

    // Lead isn't a User yet (signs up via the invite link), so call the provider
    // directly instead of sendAndLogWhatsApp (which requires a recipient User row).
    const provider = await resolveWhatsAppProvider(user.orgId, "auto");
    const r = await provider.send({ to: design.leadPhone, body: renderedBody });
    inviteSend =
      r.kind === "deeplink"
        ? { ok: true, channel: "deeplink", openUrl: r.url }
        : r.kind === "api"
        ? { ok: true, channel: "api", messageId: r.messageId }
        : { ok: false, error: r.error };
  }

  return NextResponse.json({
    ok: true,
    invitationId: result.invite.id,
    designId: result.updated.id,
    invite: inviteSend,
  });
}
