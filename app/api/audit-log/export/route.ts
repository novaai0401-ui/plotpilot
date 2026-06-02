import { NextRequest, NextResponse } from "next/server";
import { requireUser, BROKER_ROLES } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { csvDocument } from "@/lib/data-export/csv";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * GET /api/audit-log/export?type=...&actor=...&from=...&to=...
 *
 * Streams the filtered audit-log slice as CSV. Same scope rules as the rest of
 * data-export: org-scoped, broker_admin/super_admin only, logged as a
 * `data.exported` event of its own (so exporting an audit log is itself audited).
 */
export async function GET(req: NextRequest) {
  const user = await requireUser([...BROKER_ROLES, "super_admin"]);
  const sp = req.nextUrl.searchParams;
  const typeFilter = sp.get("type") || "";
  const actorFilter = sp.get("actor") || "";
  const fromFilter = sp.get("from") || "";
  const toFilter = sp.get("to") || "";

  const where: any = { orgId: user.orgId };
  if (typeFilter) where.type = typeFilter;
  if (actorFilter) where.actorId = actorFilter;
  const dateRange: any = {};
  if (fromFilter) dateRange.gte = new Date(fromFilter);
  if (toFilter) dateRange.lte = new Date(toFilter + "T23:59:59.999Z");
  if (Object.keys(dateRange).length) where.createdAt = dateRange;

  const [events, actors] = await Promise.all([
    prisma.analyticsEvent.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 50_000, // safety cap
    }),
    prisma.user.findMany({
      where: { orgId: user.orgId },
      select: { id: true, name: true, email: true },
    }),
  ]);
  const actorMap = new Map(actors.map((a) => [a.id, a]));

  const csv = csvDocument(
    ["timestamp", "type", "actor_name", "actor_email", "metadata_json"],
    events.map((e) => [
      e.createdAt.toISOString(),
      e.type,
      e.actorId ? actorMap.get(e.actorId)?.name ?? "" : "",
      e.actorId ? actorMap.get(e.actorId)?.email ?? "" : "",
      e.metadata ? JSON.stringify(e.metadata) : "",
    ])
  );

  // Audit the audit-log export itself
  await prisma.analyticsEvent.create({
    data: {
      orgId: user.orgId,
      type: "data.exported",
      actorId: user.id,
      metadata: {
        table: "audit_log",
        rowCount: events.length,
        filters: { typeFilter, actorFilter, fromFilter, toFilter },
      },
    },
  });

  const org = await prisma.organization.findUnique({
    where: { id: user.orgId },
    select: { slug: true },
  });
  const stamp = new Date().toISOString().slice(0, 10);
  const filename = `${org?.slug || "org"}_audit_log_${stamp}.csv`;

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store, private",
    },
  });
}
