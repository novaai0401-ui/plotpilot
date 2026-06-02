import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/session";
import { EXPORTERS, type ExportTable } from "@/lib/data-export/exporters";
import { prisma } from "@/lib/db/prisma";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * GET /api/data-export/[table]
 *
 * One CSV per table. broker_admin only — same-org data only.
 *
 * Filename includes org slug + date so the user gets sensible-looking files in
 * their Downloads folder.
 *
 * Logs an analytics event so auditors can confirm exports happened — useful for
 * DPDP/GDPR subject-access-request compliance.
 */
export async function GET(_req: NextRequest, { params }: { params: { table: string } }) {
  const user = await requireUser(["broker_admin", "super_admin"]);
  const table = params.table as ExportTable;
  const exporter = EXPORTERS[table];
  if (!exporter) {
    return NextResponse.json(
      { error: `Unknown table: ${table}. Known: ${Object.keys(EXPORTERS).join(", ")}` },
      { status: 404 }
    );
  }

  const csv = await exporter(user.orgId);

  // Audit log
  await prisma.analyticsEvent.create({
    data: {
      orgId: user.orgId,
      type: "data.exported",
      actorId: user.id,
      metadata: { table, sizeBytes: csv.length },
    },
  });

  const org = await prisma.organization.findUnique({
    where: { id: user.orgId },
    select: { slug: true },
  });
  const stamp = new Date().toISOString().slice(0, 10);
  const filename = `${org?.slug || "org"}_${table}_${stamp}.csv`;

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store, private",
    },
  });
}
