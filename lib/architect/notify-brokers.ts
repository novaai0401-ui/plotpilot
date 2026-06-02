import { prisma } from "@/lib/db/prisma";
import { sendEmail } from "@/lib/email/resend";
import { sendAndLogWhatsApp } from "@/lib/whatsapp/send-and-log";
import { buildWaMeUrl } from "@/lib/whatsapp";
import { distanceKm, cityMatches } from "@/lib/geo/distance";
import { logUsage } from "@/lib/usage";
import { planCaps } from "@/lib/plans";

/**
 * Geo- and preference-aware fan-out for public-lead designs.
 *
 * Eligibility filter (in order):
 *   1. Org has notifyOnPublicLead = true
 *   2. Geo match: lead's city matches org.serviceCity OR lead.coords within org.serviceRadiusKm
 *      (orgs with no geo configured = match all, treated as new orgs)
 *   3. Org has not exceeded their monthlyLeadAlertsCap
 *
 * For each eligible org, we create one Notification row per broker_admin/super_admin
 * and additionally send via channels the recipient opted into (whatsapp/email).
 *
 * Cost win: typical city has 3-5 active brokers vs the previous "all 50 orgs"
 * broadcast — 90% reduction in paid messages.
 */
export async function notifyBrokersOfPublicLead(designId: string): Promise<{
  matchedOrgs: number;
  notified: number;
  channels: { inapp: number; whatsapp: number; email: number };
  errors: string[];
}> {
  const design = await prisma.buildingDesign.findUnique({ where: { id: designId } });
  if (!design || design.source !== "public_lead" || design.brokersNotifiedAt) {
    return { matchedOrgs: 0, notified: 0, channels: { inapp: 0, whatsapp: 0, email: 0 }, errors: [] };
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const designUrl = `${appUrl}/designs/${design.id}`;
  const claimUrl = `${appUrl}/admin/leads`;
  const inboxUrl = `${appUrl}/dashboard/inbox`;
  const req = design.requirements as any;
  const projectType = String(req?.projectType || "building").replace(/_/g, " ");
  const sqft = req?.plot?.totalSqft || "?";
  const leadName = design.leadName || "Unknown";
  const leadPhone = design.leadPhone || "—";
  const leadEmail = design.leadEmail || "—";

  // 1) Find eligible orgs (geo + opt-in + cap)
  const orgs = await prisma.organization.findMany({
    where: { notifyOnPublicLead: true },
  });

  // Month-start for usage cap check
  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);

  const matched: typeof orgs = [];
  for (const o of orgs) {
    // Geo filter
    let geoMatch = false;
    if (!o.serviceCity && !o.serviceLat) {
      geoMatch = true; // unconfigured → match all (encourage early-stage orgs)
    } else {
      if (design.leadCity && cityMatches(o.serviceCity, design.leadCity)) geoMatch = true;
      if (
        !geoMatch &&
        o.serviceLat != null &&
        o.serviceLng != null &&
        design.leadLat != null &&
        design.leadLng != null
      ) {
        const d = distanceKm(
          { lat: o.serviceLat, lng: o.serviceLng },
          { lat: design.leadLat, lng: design.leadLng }
        );
        if (d <= (o.serviceRadiusKm ?? 25)) geoMatch = true;
      }
    }
    if (!geoMatch) continue;

    // Monthly lead-alert cap per plan
    const caps = planCaps(o.plan);
    const monthlyCount = await prisma.notification.count({
      where: { orgId: o.id, type: "public_lead", createdAt: { gte: monthStart } },
    });
    if (monthlyCount >= caps.monthlyLeadAlertsCap) continue;

    matched.push(o);
  }

  // 2) For each eligible org, fan out
  const whatsappBody =
    `🏗️ New lead: ${leadName} — ${projectType} (${sqft} sqft)\n` +
    `${leadPhone}${leadEmail !== "—" ? ` · ${leadEmail}` : ""}\n` +
    `View: ${designUrl}\nClaim: ${claimUrl}`;

  const emailHtml = leadAlertEmailHtml({
    leadName,
    leadPhone,
    leadEmail,
    projectType,
    sqft: String(sqft),
    designUrl,
    claimUrl,
  });

  let inappCount = 0;
  let whatsappCount = 0;
  let emailCount = 0;
  const errors: string[] = [];

  for (const org of matched) {
    // Re-check plan capabilities at send time — handles retroactive downgrade:
    // if a broker was on Enterprise (WhatsApp allowed) and dropped to Pro, their
    // org.notifyViaWhatsApp preference may still be `true` but their current plan
    // no longer includes the Business API. Forcibly disable channels their current
    // plan doesn't cover.
    const orgCaps = planCaps(org.plan);

    const recipients = await prisma.user.findMany({
      where: { orgId: org.id, role: { in: ["broker_admin", "super_admin"] } },
    });

    for (const u of recipients) {
      // Per-user channel choice = user override OR org default
      const wantInApp = u.notifyViaInApp ?? org.notifyViaInApp;
      const wantEmail = u.notifyViaEmail ?? org.notifyViaEmail;
      // WhatsApp gated by current plan, even if the org/user preference is on.
      const wantWhatsApp =
        (u.notifyViaWhatsApp ?? org.notifyViaWhatsApp) && orgCaps.whatsappBusinessApi;

      // Always create in-app notification if the user accepts it
      if (wantInApp) {
        await prisma.notification.create({
          data: {
            orgId: org.id,
            userId: u.id,
            type: "public_lead",
            title: `New lead: ${leadName} (${projectType})`,
            body: `${leadName} · ${leadPhone} · ${sqft} sqft ${projectType}`,
            link: `/admin/leads`,
            metadata: { designId: design.id, leadName, leadPhone, leadEmail, projectType, sqft },
          },
        });
        inappCount++;
      }

      // Email (very cheap)
      if (wantEmail && u.email) {
        const r = await sendEmail({
          to: u.email,
          subject: `🏗️ New lead: ${leadName} — ${projectType} (${sqft} sqft)`,
          html: emailHtml,
          text:
            `New lead generated a design.\n\n` +
            `${leadName} · ${leadPhone} · ${leadEmail}\n${projectType}, ${sqft} sqft\n\n` +
            `View: ${designUrl}\nClaim: ${claimUrl}\n\n(or open your in-app inbox: ${inboxUrl})`,
        });
        if (r.ok) {
          emailCount++;
          await logUsage(org.id, "email_send", { metadata: { kind: "lead_alert" } });
        } else {
          errors.push(`email ${u.id}: ${r.error}`);
        }
      }

      // WhatsApp (expensive — only if opted in)
      if (wantWhatsApp && u.phone) {
        try {
          const r = await sendAndLogWhatsApp({
            orgId: org.id,
            senderId: u.id,
            recipientId: u.id,
            recipientPhone: u.phone,
            body: whatsappBody,
            preference: "auto",
          });
          if (r.ok) {
            whatsappCount++;
            await logUsage(org.id, "whatsapp_message", { metadata: { kind: "lead_alert" } });
          } else {
            errors.push(`whatsapp ${u.id}: ${r.error}`);
          }
        } catch (e: any) {
          errors.push(`whatsapp ${u.id}: ${e?.message || e}`);
        }
      }
    }
  }

  await prisma.buildingDesign.update({
    where: { id: design.id },
    data: { brokersNotifiedAt: new Date() },
  });

  return {
    matchedOrgs: matched.length,
    notified: inappCount + whatsappCount + emailCount,
    channels: { inapp: inappCount, whatsapp: whatsappCount, email: emailCount },
    errors: errors.slice(0, 10),
  };
}

function leadAlertEmailHtml(v: {
  leadName: string;
  leadPhone: string;
  leadEmail: string;
  projectType: string;
  sqft: string;
  designUrl: string;
  claimUrl: string;
}): string {
  const esc = (s: string) =>
    s.replace(/[&<>"']/g, (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!)
    );
  const waUrl = buildWaMeUrl(v.leadPhone, `Hi ${v.leadName}, regarding the building design you generated:`);
  return `<!doctype html>
<html><body style="margin:0;padding:0;background:#f6f8f7;font-family:system-ui,sans-serif;color:#111827;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f8f7;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;border:1px solid #e5e7eb;">
        <tr><td style="padding:28px 28px 8px;">
          <div style="font-size:13px;color:#0f766e;font-weight:700;">PlotBroker · new lead</div>
          <h1 style="margin:6px 0 0;font-size:22px;line-height:1.3;">${esc(v.leadName)} just generated a design</h1>
          <p style="margin:10px 0 0;color:#4b5563;font-size:14px;">${esc(v.projectType)} · ${esc(v.sqft)} sqft</p>
        </td></tr>
        <tr><td style="padding:8px 28px 0;">
          <table cellpadding="6" cellspacing="0" style="font-size:14px;color:#374151;">
            <tr><td style="color:#6b7280;width:80px;">Phone</td><td><a href="${esc(waUrl)}" style="color:#0f766e;text-decoration:none;">${esc(v.leadPhone)}</a></td></tr>
            <tr><td style="color:#6b7280;">Email</td><td>${esc(v.leadEmail)}</td></tr>
          </table>
        </td></tr>
        <tr><td style="padding:18px 28px 28px;">
          <a href="${esc(v.designUrl)}" style="display:inline-block;background:#0f766e;color:#ffffff;padding:10px 18px;border-radius:6px;text-decoration:none;font-weight:600;font-size:14px;margin-right:6px;">View design</a>
          <a href="${esc(v.claimUrl)}" style="display:inline-block;background:#ffffff;color:#0f766e;border:1px solid #0f766e;padding:10px 18px;border-radius:6px;text-decoration:none;font-weight:600;font-size:14px;">Claim lead →</a>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}
