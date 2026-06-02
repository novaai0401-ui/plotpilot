import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { buildDesignPdf } from "@/lib/architect/export-pdf";
import { sendEmail } from "@/lib/email/resend";
import {
  leadFollowupHtml,
  leadFollowupText,
  pickSubjectVariant,
  renderSubject,
} from "@/lib/email/templates";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Daily cron: find public_lead designs generated 24-72h ago, with an email,
 * that haven't received a follow-up yet. Send a single nurture email with
 * the design link + PDF attached.
 *
 * Window is 24-72h (not just "24h ago") so we cover gaps if the cron misses
 * a day. The `followupEmailSentAt` flag ensures idempotency.
 *
 * Auth: same CRON_SECRET pattern as the visit-reminders cron.
 */
export async function GET(req: NextRequest) {
  const provided =
    req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ||
    req.nextUrl.searchParams.get("secret");
  if (process.env.CRON_SECRET && provided !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const currentHour = now.getUTCHours();
  const lowerBound = new Date(now.getTime() - 72 * 60 * 60 * 1000);
  const upperBound = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  // Send-time optimization: leads have no User row, so we infer "best hour" from
  // when previous leads with the same domain/region opened their emails.
  // Fallback: send if currentHour ∈ [9, 11] UTC ≈ morning India / early Asia.
  // (Lead-specific personalization would need per-user history; this is a v1 heuristic.)
  const isFallbackHour = currentHour >= 9 && currentHour <= 11;

  // Aggregate hour-of-open histogram for leads that already opened — pick the modal hour as global "best".
  const opens = await prisma.buildingDesign.findMany({
    where: { followupEmailOpenedAt: { not: null } },
    select: { followupEmailOpenedAt: true },
    take: 1000,
  });
  const histogram: number[] = new Array(24).fill(0);
  for (const o of opens) {
    if (o.followupEmailOpenedAt) histogram[o.followupEmailOpenedAt.getUTCHours()]++;
  }
  let bestHour = isFallbackHour ? currentHour : 10;
  if (opens.length > 50) {
    bestHour = histogram.reduce((bI, v, i, a) => (v > a[bI] ? i : bI), 0);
  }
  // Only run sends in a ±1h window around bestHour
  const inSendWindow = Math.abs(currentHour - bestHour) <= 1 || isFallbackHour;
  if (!inSendWindow) {
    return NextResponse.json({ ok: true, skipped: "outside send window", currentHour, bestHour });
  }

  const candidates = await prisma.buildingDesign.findMany({
    where: {
      source: "public_lead",
      status: "ready",
      followupEmailSentAt: null,
      leadEmail: { not: null },
      createdAt: { gte: lowerBound, lte: upperBound },
    },
    take: 200,
  });

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const appName = "PlotBroker";

  let sent = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const d of candidates) {
    try {
      const req = d.requirements as any;
      const designUrl = `${appUrl}/designs/${d.id}`;

      // Render the PDF for attachment
      const pdfBytes = await buildDesignPdf({
        requirements: d.requirements as any,
        brief: d.brief as any,
        narrative: d.narrative,
        floorPlansSvg: (d.floorPlansSvg as any) || [],
        renderImageUrl: d.renderImageUrl,
        generatedAt: d.createdAt,
        designId: d.id,
      });

      const vars = {
        name: d.leadName || "there",
        projectType: req?.projectType || "building",
        totalSqft: req?.plot?.totalSqft || 0,
        designUrl,
        appName,
      };

      // A/B subject variant + tracking URLs
      const variant = pickSubjectVariant(d.id);
      const subject = renderSubject(variant, vars);
      const clickUrl = `${appUrl}/api/email/track/${d.id}/click?to=${encodeURIComponent(designUrl)}`;
      const pixelUrl = `${appUrl}/api/email/track/${d.id}/open.gif`;

      const result = await sendEmail({
        to: d.leadEmail!,
        subject,
        html: leadFollowupHtml(vars, { clickUrl, pixelUrl }),
        text: leadFollowupText(vars),
        attachments: [
          { filename: `design-${d.id.slice(0, 8)}.pdf`, content: pdfBytes },
        ],
      });

      if (result.ok) {
        await prisma.buildingDesign.update({
          where: { id: d.id },
          data: { followupEmailSentAt: new Date(), followupEmailVariant: variant },
        });
        sent++;
      } else {
        failed++;
        errors.push(`${d.id}: ${result.error}`);
      }
    } catch (e: any) {
      failed++;
      errors.push(`${d.id}: ${e?.message || e}`);
    }
  }

  return NextResponse.json({
    ok: true,
    candidates: candidates.length,
    sent,
    failed,
    errors: errors.slice(0, 10),
  });
}
