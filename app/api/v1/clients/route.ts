import { NextRequest, NextResponse } from "next/server";
import { requireScope } from "@/lib/auth/api-token";
import { prisma } from "@/lib/db/prisma";

export const dynamic = "force-dynamic";

/**
 * GET /api/v1/clients
 * Required scope: clients:read
 *
 * Lists clients in the token-bearer's org with their (already-public-to-broker)
 * preference summary. Phone numbers are returned because that's the field
 * external apps most commonly need (WhatsApp deep-links, SMS); orgs that
 * don't want their phone numbers leaking should not approve the scope.
 */
export async function GET(req: NextRequest) {
  const guard = await requireScope(req, "clients:read");
  if (!guard.ok) return NextResponse.json(guard.body, { status: guard.status });

  const { principal } = guard;
  const url = new URL(req.url);
  const limit = Math.min(parseInt(url.searchParams.get("limit") || "20", 10) || 20, 100);
  const cursor = url.searchParams.get("cursor") || undefined;

  const rows = await prisma.user.findMany({
    where: { orgId: principal.user.orgId, role: "client" },
    orderBy: { createdAt: "desc" },
    take: limit + 1,
    ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      preferences: true,
      createdAt: true,
    },
  });

  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;

  return NextResponse.json({
    data: items,
    nextCursor: hasMore ? items[items.length - 1]!.id : null,
  });
}
