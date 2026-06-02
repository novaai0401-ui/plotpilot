import { prisma } from "@/lib/db/prisma";
import type { UsageKind } from "@prisma/client";

/**
 * Approximate per-unit costs (USD micro). Update if vendors change pricing.
 * Stored as micro-USD (millionths) for precision on small per-call costs.
 *
 * Sources (Nov 2025 indicative):
 *   - Claude Sonnet 4.5: $3/M in, $15/M out → average ~$0.01 for our 1500-token narrative
 *   - Replicate Flux-schnell: $0.003/image
 *   - WhatsApp Business marketing: ~$0.025 in IN (varies by country/category)
 *   - WhatsApp utility: ~$0.007
 *   - Resend: free up to 100/day, then $0.40/1000
 */
export const UNIT_COST_MICRO_USD: Record<UsageKind, number> = {
  llm_tokens: 10_000,        // $0.01 per narrative average
  render_request: 3_000,     // $0.003 per image
  whatsapp_message: 25_000,  // $0.025 per marketing-template message
  email_send: 400,           // $0.0004 per email (post free tier)
};

export async function logUsage(
  orgId: string,
  kind: UsageKind,
  opts?: { units?: number; metadata?: any; freeOfCharge?: boolean }
) {
  const units = opts?.units ?? 1;
  const cost = opts?.freeOfCharge ? 0 : UNIT_COST_MICRO_USD[kind] * units;
  await prisma.usageEvent.create({
    data: {
      orgId,
      kind,
      units,
      costUsdMicro: BigInt(cost),
      metadata: opts?.metadata,
    },
  });
}

/**
 * Sum month-to-date usage cost per kind for an org.
 * Returns USD cents (integer).
 */
export async function monthToDateSpendCents(orgId: string): Promise<Record<UsageKind, number>> {
  const start = new Date();
  start.setUTCDate(1);
  start.setUTCHours(0, 0, 0, 0);

  const rows = await prisma.usageEvent.groupBy({
    by: ["kind"],
    where: { orgId, createdAt: { gte: start } },
    _sum: { costUsdMicro: true, units: true },
  });

  const out: any = { llm_tokens: 0, render_request: 0, whatsapp_message: 0, email_send: 0 };
  for (const r of rows) {
    out[r.kind] = Number((r._sum.costUsdMicro ?? BigInt(0)) / BigInt(10_000));
  }
  return out;
}

export async function monthToDateUnits(orgId: string): Promise<Record<UsageKind, number>> {
  const start = new Date();
  start.setUTCDate(1);
  start.setUTCHours(0, 0, 0, 0);

  const rows = await prisma.usageEvent.groupBy({
    by: ["kind"],
    where: { orgId, createdAt: { gte: start } },
    _sum: { units: true },
  });

  const out: any = { llm_tokens: 0, render_request: 0, whatsapp_message: 0, email_send: 0 };
  for (const r of rows) out[r.kind] = r._sum.units ?? 0;
  return out;
}

export function microToDollars(micro: bigint | number): number {
  return Number(micro) / 1_000_000;
}
