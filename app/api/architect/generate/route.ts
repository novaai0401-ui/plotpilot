import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser } from "@/lib/auth/session";
import { RequirementsSchema, buildableFootprint } from "@/lib/architect/requirements";
import { generateBrief } from "@/lib/architect/rules";
import { renderAllFloors } from "@/lib/architect/floor-plan-svg";
import { generateNarrative } from "@/lib/architect/llm";
import { generateRender } from "@/lib/architect/render-image";
import { checkRateLimit, clientIp } from "@/lib/rate-limit";
import { notifyBrokersOfPublicLead } from "@/lib/architect/notify-brokers";
import { planCaps, PUBLIC_FLOW_CAPABILITIES } from "@/lib/plans";
import { checkMonthlyDesignsCap } from "@/lib/usage-caps";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/**
 * POST /api/architect/generate
 *
 * Body: {
 *   requirements: <RequirementsSchema>,
 *   plotId?: string,             // links design to a plot (broker flow)
 *   source: "broker" | "client" | "public_lead" | "standalone",
 *   lead?: { name, phone, email } // required for public_lead, optional otherwise
 * }
 *
 * Pipeline:
 *   1. Validate requirements (Zod)
 *   2. Create BuildingDesign row with status=generating
 *   3. Rules engine → deterministic brief + SVG floor plans (synchronous, fast)
 *   4. In parallel: LLM narrative + image render (can take 5-60s)
 *   5. Update row to status=ready, return id + outputs
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = RequirementsSchema.safeParse(body.requirements);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid requirements", issues: parsed.error.flatten() },
        { status: 400 }
      );
    }
    const requirements = parsed.data;
    const source = String(body.source || "standalone") as
      | "broker"
      | "client"
      | "public_lead"
      | "standalone";

    const user = await getSessionUser();
    let orgId: string | null = null;
    let plotId: string | null = body.plotId || null;
    let createdById: string | null = user?.id || null;
    const lead = body.lead || {};

    if (source === "public_lead") {
      if (!lead.name || !lead.phone) {
        return NextResponse.json(
          { error: "Public lead flow requires name and phone." },
          { status: 400 }
        );
      }

      // Anonymous endpoint costs real money (LLM + image). Apply three limits:
      //  - IP-based: 3 generations / hour per IP (tightened from 5)
      //  - phone-based: 2 generations / day per phone (tightened from 3 — prevents lead spam)
      //  - global daily ceiling: 200 total/day across all IPs (kill-switch against
      //    determined adversaries with proxy pools; legitimate traffic is well below this)
      const ip = clientIp(req);
      const globalCheck = await checkRateLimit("global", {
        prefix: "architect_public_global",
        max: 200,
        windowMs: 24 * 60 * 60 * 1000,
      });
      if (!globalCheck.success) {
        return NextResponse.json(
          {
            error: "Today's public-design quota is exhausted. Please sign up for a free account.",
            retryAt: globalCheck.resetAt,
          },
          { status: 429, headers: rateLimitHeaders(globalCheck) }
        );
      }
      const ipCheck = await checkRateLimit(ip, {
        prefix: "architect_public_ip",
        max: 3,
        windowMs: 60 * 60 * 1000,
      });
      if (!ipCheck.success) {
        return NextResponse.json(
          {
            error: `Rate limit exceeded. Try again after ${new Date(ipCheck.resetAt).toLocaleTimeString()}.`,
            retryAt: ipCheck.resetAt,
          },
          { status: 429, headers: rateLimitHeaders(ipCheck) }
        );
      }
      const phoneCheck = await checkRateLimit(String(lead.phone).replace(/[^\d]/g, ""), {
        prefix: "architect_public_phone",
        max: 2,
        windowMs: 24 * 60 * 60 * 1000,
      });
      if (!phoneCheck.success) {
        return NextResponse.json(
          { error: "Daily limit reached for this phone number. Try again tomorrow." },
          { status: 429, headers: rateLimitHeaders(phoneCheck) }
        );
      }

      orgId = null; // anonymous — not tied to an org
      plotId = null;
      createdById = null;
    } else {
      if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
      orgId = user.orgId;
      // If plotId is given, verify it belongs to caller's org
      if (plotId) {
        const plot = await prisma.plot.findFirst({ where: { id: plotId, orgId: user.orgId } });
        if (!plot)
          return NextResponse.json({ error: "Plot not found in your org" }, { status: 404 });
      }

      // Hard cap: monthly designs per plan. Return 402 with upgrade details
      // so the client can show an upgrade modal instead of a generic error.
      const capCheck = await checkMonthlyDesignsCap(user.orgId);
      if (!capCheck.ok) {
        return NextResponse.json(
          {
            error: capCheck.message,
            cap: {
              reason: capCheck.reason,
              currentPlan: capCheck.currentPlan,
              currentPlanLabel: capCheck.currentPlanLabel,
              suggestUpgradeTo: capCheck.suggestUpgradeTo,
              used: capCheck.used,
              limit: capCheck.cap,
            },
          },
          { status: 402 }
        );
      }
    }

    // Capture lead location for geo routing (optional)
    const leadCity = body.leadCity || lead.city || null;
    const leadLat = typeof body.leadLat === "number" ? body.leadLat : null;
    const leadLng = typeof body.leadLng === "number" ? body.leadLng : null;

    const design = await prisma.buildingDesign.create({
      data: {
        orgId,
        plotId,
        createdById,
        source,
        status: "generating",
        requirements: requirements as any,
        leadName: lead.name || null,
        leadPhone: lead.phone || null,
        leadEmail: lead.email || null,
        leadCity,
        leadLat,
        leadLng,
      },
    });

    // Step 1: deterministic brief + SVG (fast, can't fail, zero cost)
    const brief = generateBrief(requirements);
    const footprint = buildableFootprint(requirements);
    const svgs = renderAllFloors(brief.floors, requirements, footprint);

    // Resolve which AI features this caller can use.
    // Public flow uses platform-funded capabilities; broker flow uses their plan tier.
    let caps = PUBLIC_FLOW_CAPABILITIES;
    if (source !== "public_lead" && orgId) {
      const org = await prisma.organization.findUnique({ where: { id: orgId }, select: { plan: true } });
      if (org) caps = planCaps(org.plan);
    }

    // Step 2: parallel LLM + image (plan-gated, cached)
    const billingOrgId = orgId; // null for public_lead — no broker billed
    const [narrativeResult, renderResult] = await Promise.allSettled([
      caps.llmNarrative
        ? generateNarrative(requirements, brief, billingOrgId)
        : Promise.resolve({ text: null, cacheHit: false, costMicroUsd: 0 }),
      caps.aiRender
        ? generateRender(requirements, billingOrgId)
        : Promise.resolve(null),
    ]);

    const narrativeRes =
      narrativeResult.status === "fulfilled" ? narrativeResult.value : { text: null, cacheHit: false, costMicroUsd: 0 };
    const narrative = (narrativeRes as any).text;
    const llmCacheHit = (narrativeRes as any).cacheHit ?? false;

    const renderOk = renderResult.status === "fulfilled" ? renderResult.value : null;
    const renderCacheHit = renderOk?.cacheHit ?? false;

    const updated = await prisma.buildingDesign.update({
      where: { id: design.id },
      data: {
        status: "ready",
        brief: brief as any,
        narrative,
        floorPlansSvg: svgs as any,
        renderImageUrl: renderOk?.url || null,
        renderPrompt: renderOk?.prompt || null,
        llmCacheHit,
        renderCacheHit,
      },
    });

    if (orgId) {
      await prisma.analyticsEvent.create({
        data: {
          orgId,
          type: "design.generated",
          actorId: createdById,
          metadata: { designId: design.id, source, plotId },
        },
      });
    }

    // Fan-out broker alerts for public leads (fire-and-forget so we don't delay the response).
    if (source === "public_lead") {
      notifyBrokersOfPublicLead(updated.id).catch((e) =>
        console.error("[notify-brokers] failed:", e)
      );
    }

    return NextResponse.json({
      id: updated.id,
      brief,
      narrative,
      floorPlansSvg: svgs,
      renderImageUrl: updated.renderImageUrl,
    });
  } catch (e: any) {
    console.error("[architect/generate] error:", e);
    return NextResponse.json(
      { error: e?.message || "Server error" },
      { status: 500 }
    );
  }
}

function rateLimitHeaders(r: { limit: number; remaining: number; resetAt: number }) {
  return {
    "X-RateLimit-Limit": String(r.limit),
    "X-RateLimit-Remaining": String(r.remaining),
    "X-RateLimit-Reset": String(Math.ceil(r.resetAt / 1000)),
  };
}
