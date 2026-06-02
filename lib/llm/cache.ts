import { prisma } from "@/lib/db/prisma";
import type { LlmKind } from "./models";

/**
 * Persistent LLM-output cache.
 *
 * The single biggest cost lever in the AI Co-Pilot stack: by caching outputs
 * keyed by sha256 of canonical input, the same (plot, client) pitch or the
 * same plot valuation is paid for AT MOST ONCE. When the plot's underlying
 * data changes, the key changes, the cache misses, the LLM runs once more.
 *
 * Compared to the prior in-process Map: this survives cold boots, scales
 * across serverless instances, persists for the full TTL window.
 *
 * TTLs (configurable per kind):
 *   - pitch:     30 days. A pitch goes stale if the broker forgets it for
 *                a month, plus we want re-asks of stale matches to refresh.
 *   - valuation: 60 days. Market conditions drift; we don't want a 6-month-
 *                old AI valuation to look authoritative.
 */

const TTL_DAYS: Record<LlmKind, number> = {
  pitch: 30,
  valuation: 60,
};

export type CachedValue<T> = { value: T; cacheHit: true } | { cacheHit: false };

/**
 * Try to read a cached value. Returns `{cacheHit: false}` if the row is
 * missing or has expired. Bumps `hitAt` on read so an LRU eviction job
 * (future) can rotate cold entries first.
 *
 * Best-effort: any Prisma failure (DB down, edge runtime) returns a miss
 * — the caller then runs the LLM. Cache is a cost optimization, never
 * a correctness dependency.
 */
export async function getLlmCache<T>(
  kind: LlmKind,
  key: string
): Promise<CachedValue<T>> {
  try {
    const row = await prisma.llmCache.findUnique({
      where: { kind_key: { kind, key } },
    });
    if (!row) return { cacheHit: false };
    if (row.ttlAt < new Date()) {
      // Expired — don't return, let the caller regenerate. Leave the row;
      // upsert below will rewrite it with a fresh ttl.
      return { cacheHit: false };
    }
    // Bump hitAt for the LRU job. Awaited because the next read should
    // see the fresher value, but if it errors we don't surface it.
    await prisma.llmCache
      .update({ where: { id: row.id }, data: { hitAt: new Date() } })
      .catch(() => {});
    return { value: row.value as T, cacheHit: true };
  } catch {
    return { cacheHit: false };
  }
}

/**
 * Store an LLM output. Upserts so re-generation overwrites any expired row.
 * Best-effort — Prisma failures are swallowed (we just lose a future cache hit).
 */
export async function setLlmCache<T>(
  kind: LlmKind,
  key: string,
  value: T,
  orgId: string | null = null
): Promise<void> {
  const ttlMs = TTL_DAYS[kind] * 24 * 60 * 60 * 1000;
  const ttlAt = new Date(Date.now() + ttlMs);
  try {
    await prisma.llmCache.upsert({
      where: { kind_key: { kind, key } },
      create: { kind, key, value: value as object, orgId, ttlAt, hitAt: new Date() },
      update: { value: value as object, ttlAt, hitAt: new Date(), orgId },
    });
  } catch {
    /* best effort */
  }
}
