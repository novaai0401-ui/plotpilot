import { NextRequest, NextResponse } from "next/server";
import { requireScope } from "@/lib/auth/api-token";
import { prisma } from "@/lib/db/prisma";

export const dynamic = "force-dynamic";

/**
 * GET /api/v1/plots
 * Required scope: plots:read
 *
 * Lists every plot in the token-bearer's org. Multi-tenant safety is
 * inherited: the token resolves to a User row with an orgId, and the
 * query filters by that orgId. There's no way to read another org's plots.
 *
 * Pagination: simple `?cursor=` + `?limit=` (max 100).
 */
export async function GET(req: NextRequest) {
  const guard = await requireScope(req, "plots:read");
  if (!guard.ok) return NextResponse.json(guard.body, { status: guard.status });

  const { principal } = guard;
  const url = new URL(req.url);
  const limit = Math.min(parseInt(url.searchParams.get("limit") || "20", 10) || 20, 100);
  const cursor = url.searchParams.get("cursor") || undefined;

  const rows = await prisma.plot.findMany({
    where: { orgId: principal.user.orgId },
    orderBy: { createdAt: "desc" },
    take: limit + 1,
    ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    select: {
      id: true,
      title: true,
      description: true,
      location: true,
      city: true,
      sizeSqft: true,
      priceInr: true,
      status: true,
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
