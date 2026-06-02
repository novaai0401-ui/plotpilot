import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { sendAndLogWhatsApp } from "@/lib/whatsapp/send-and-log";
import { renderTemplate } from "@/lib/whatsapp";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Daily cron (configured in vercel.json): finds tomorrow's scheduled visits
 * and sends WhatsApp reminders using each org's configured WhatsApp provider.
 *
 * Auth: Vercel attaches `Authorization: Bearer $CRON_SECRET` when CRON_SECRET
 * is set in the project env. We also accept `?secret=` for local curl testing.
 */
export async function GET(req: NextRequest) {
  const provided =
    req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ||
    req.nextUrl.searchParams.get("secret");
  if (process.env.CRON_SECRET && provided !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const startOfTomorrow = new Date(now);
  startOfTomorrow.setDate(startOfTomorrow.getDate() + 1);
  startOfTomorrow.setHours(0, 0, 0, 0);
  const endOfTomorrow = new Date(startOfTomorrow);
  endOfTomorrow.setHours(23, 59, 59, 999);

  const visits = await prisma.visit.findMany({
    where: {
      status: "scheduled",
      scheduledAt: { gte: startOfTomorrow, lte: endOfTomorrow },
    },
    include: {
      plot: true,
      client: true,
      agent: true,
      org: { include: { whatsappConfig: true } },
    },
  });

  let sent = 0;
  let skipped = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const v of visits) {
    // Idempotency: skip if a reminder message already exists for this visit today
    const existing = await prisma.message.findFirst({
      where: {
        visitId: v.id,
        createdAt: { gte: new Date(now.getTime() - 12 * 60 * 60 * 1000) },
        body: { contains: "reminder" },
      },
    });
    if (existing) {
      skipped++;
      continue;
    }

    const template =
      v.org.whatsappConfig?.reminderTemplate ||
      "Hi {name}, reminder for your visit to {plot} at {time}.";
    const body = renderTemplate(template, {
      name: v.client.name,
      plot: v.plot.title,
      time: new Date(v.scheduledAt).toLocaleString(),
    });

    const result = await sendAndLogWhatsApp({
      orgId: v.orgId,
      senderId: v.agentId,
      recipientId: v.clientId,
      recipientPhone: v.client.phone,
      body,
      visitId: v.id,
      // Cron prefers API send when org supports it (auto-resolves)
      preference: "auto",
    });

    if (result.ok) sent++;
    else {
      failed++;
      errors.push(`visit ${v.id}: ${result.error}`);
    }
  }

  return NextResponse.json({
    ok: true,
    visitsConsidered: visits.length,
    sent,
    skipped,
    failed,
    errors: errors.slice(0, 10),
  });
}
