import { requireUser, BROKER_ROLES } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { monthToDateSpendCents, monthToDateUnits } from "@/lib/usage";
import { planCaps } from "@/lib/plans";
import { ManageSubscription } from "@/components/billing/manage-subscription";
import { UsageTable, type UsageRow } from "@/components/usage/usage-table";
import { UsagePageShell } from "@/components/usage/usage-page-shell";

export default async function UsagePage() {
  const user = await requireUser(BROKER_ROLES);
  const [org, spendCents, units] = await Promise.all([
    prisma.organization.findUnique({ where: { id: user.orgId } }),
    monthToDateSpendCents(user.orgId),
    monthToDateUnits(user.orgId),
  ]);
  if (!org) return null;

  const caps = planCaps(org.plan);

  const now = new Date();
  const dayOfMonth = now.getUTCDate();
  const daysInMonth = new Date(now.getUTCFullYear(), now.getUTCMonth() + 1, 0).getUTCDate();
  const projectionMultiplier = daysInMonth / dayOfMonth;

  const totalCents = Object.values(spendCents).reduce((s, c) => s + c, 0);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const [cachedNarratives, cachedRenders, designsThisMonth] = await Promise.all([
    prisma.buildingDesign.count({ where: { orgId: org.id, llmCacheHit: true, createdAt: { gte: monthStart } } }),
    prisma.buildingDesign.count({ where: { orgId: org.id, renderCacheHit: true, createdAt: { gte: monthStart } } }),
    prisma.buildingDesign.count({ where: { orgId: org.id, createdAt: { gte: monthStart } } }),
  ]);
  const savedCents = cachedNarratives * 1 + cachedRenders * 0.3;

  const rows: UsageRow[] = [
    {
      kind: "llm_tokens",
      label: "AI narrative",
      units: units.llm_tokens,
      unitLabel: "tokens",
      cents: spendCents.llm_tokens,
      projectedCents: spendCents.llm_tokens * projectionMultiplier,
    },
    {
      kind: "render_request",
      label: "AI render image",
      units: units.render_request,
      unitLabel: "renders",
      cents: spendCents.render_request,
      projectedCents: spendCents.render_request * projectionMultiplier,
    },
    {
      kind: "whatsapp_message",
      label: "WhatsApp Business",
      units: units.whatsapp_message,
      unitLabel: "messages",
      cents: spendCents.whatsapp_message,
      projectedCents: spendCents.whatsapp_message * projectionMultiplier,
    },
    {
      kind: "email_send",
      label: "Email",
      units: units.email_send,
      unitLabel: "emails",
      cents: spendCents.email_send,
      projectedCents: spendCents.email_send * projectionMultiplier,
    },
  ];

  return (
    <UsagePageShell
      planLabel={caps.label}
      priceInr={caps.priceInr}
      renewsOn={
        org.subscriptionEndsAt && org.subscriptionStatus === "active"
          ? new Date(org.subscriptionEndsAt).toLocaleDateString()
          : null
      }
      headlineKpis={{
        spendCents: totalCents,
        projectedSpendCents: totalCents * projectionMultiplier,
        savedCents,
        cacheHitCount: cachedNarratives + cachedRenders,
        designsUsed: designsThisMonth,
        designsCap: caps.monthlyDesignsCap,
        leadAlerts: units.whatsapp_message + units.email_send,
        leadAlertsCap: caps.monthlyLeadAlertsCap,
      }}
      manageSubscription={
        <ManageSubscription
          plan={org.plan}
          subscriptionStatus={org.subscriptionStatus}
          usedDesigns={designsThisMonth}
          designsCap={caps.monthlyDesignsCap}
          currentPlanLabel={caps.label}
        />
      }
      table={<UsageTable rows={rows} />}
    />
  );
}
