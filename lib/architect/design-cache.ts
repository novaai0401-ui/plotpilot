import { createHash } from "crypto";
import { prisma } from "@/lib/db/prisma";
import type { Requirements } from "./requirements";

/**
 * Cache key = SHA-256 of canonicalized requirements relevant to each output kind.
 *
 * - LLM narrative depends on: projectType, plot summary, floor count, room counts, style/preferences.
 *   It does NOT depend on lead's personal info or budget range.
 * - Render image depends on: projectType, style, floors, amenities (balcony/garden/solar), climate.
 *   Much narrower input → very high cache hit rate.
 *
 * TTL: 30 days. Brokers/leads asking similar questions in a month all share one paid call.
 */

const TTL_DAYS = 30;

/**
 * Rules-engine version. Bump this when canonicalization rules, ROOM_LIBRARY sizes,
 * cost multipliers, or any logic feeding into the cached output changes — that
 * invalidates every cache entry produced under the old version. Cheap defense
 * against "stale brief returned after a logic update" bugs.
 */
const RULES_VERSION = "v1";

/**
 * Stable, deep, key-sorted JSON. Required because the previous implementation
 * used `JSON.stringify(obj, Object.keys(obj))` which filters nested keys at
 * every level — silently dropping properties like `totalSqft` from inside `plot`
 * and making the hash insensitive to most of the input. Caught by tests.
 */
function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return "[" + value.map(stableStringify).join(",") + "]";
  const keys = Object.keys(value as object).sort();
  return (
    "{" +
    keys
      .map((k) => JSON.stringify(k) + ":" + stableStringify((value as any)[k]))
      .join(",") +
    "}"
  );
}

function canonicalizeForNarrative(r: Requirements): string {
  const pick = {
    v: RULES_VERSION,
    projectType: r.projectType,
    plot: {
      totalSqft: roundTo(r.plot.totalSqft, 100),
      facing: r.plot.facing,
      maxFAR: r.plot.maxFAR,
    },
    floors: r.floors,
    unitsPerFloor: r.unitsPerFloor,
    rooms: r.rooms,
    commercial: r.commercial,
    amenities: r.amenities,
    preferences: r.preferences,
  };
  return stableStringify(pick);
}

function canonicalizeForRender(r: Requirements): string {
  const pick = {
    v: RULES_VERSION,
    projectType: r.projectType,
    floors: r.floors,
    style: r.preferences.style,
    climate: r.preferences.climate,
    balcony: r.amenities.balcony,
    garden: r.amenities.garden,
    solar: r.amenities.solar,
    sqftBucket: Math.floor(r.plot.totalSqft / 500),
  };
  return stableStringify(pick);
}

function sha256(s: string): string {
  return createHash("sha256").update(s).digest("hex");
}

export function narrativeHash(r: Requirements): string {
  return sha256(canonicalizeForNarrative(r));
}
export function renderHash(r: Requirements): string {
  return sha256(canonicalizeForRender(r));
}

export async function getCachedNarrative(r: Requirements): Promise<string | null> {
  const hash = narrativeHash(r);
  const row = await prisma.designCache.findUnique({ where: { kind_hash: { kind: "narrative", hash } } });
  if (!row || row.expiresAt < new Date()) return null;
  // Increment hit counter (best-effort)
  prisma.designCache
    .update({ where: { id: row.id }, data: { hits: { increment: 1 } } })
    .catch(() => {});
  return row.payload;
}

export async function setCachedNarrative(r: Requirements, narrative: string, metadata?: any) {
  const hash = narrativeHash(r);
  const expiresAt = new Date(Date.now() + TTL_DAYS * 24 * 60 * 60 * 1000);
  await prisma.designCache.upsert({
    where: { kind_hash: { kind: "narrative", hash } },
    create: { kind: "narrative", hash, payload: narrative, metadata, expiresAt },
    update: { payload: narrative, metadata, expiresAt },
  });
}

export async function getCachedRender(r: Requirements): Promise<{ url: string; prompt: string } | null> {
  const hash = renderHash(r);
  const row = await prisma.designCache.findUnique({ where: { kind_hash: { kind: "render", hash } } });
  if (!row || row.expiresAt < new Date()) return null;
  prisma.designCache.update({ where: { id: row.id }, data: { hits: { increment: 1 } } }).catch(() => {});
  return { url: row.payload, prompt: (row.metadata as any)?.prompt || "" };
}

export async function setCachedRender(r: Requirements, url: string, prompt: string) {
  const hash = renderHash(r);
  const expiresAt = new Date(Date.now() + TTL_DAYS * 24 * 60 * 60 * 1000);
  await prisma.designCache.upsert({
    where: { kind_hash: { kind: "render", hash } },
    create: { kind: "render", hash, payload: url, metadata: { prompt }, expiresAt },
    update: { payload: url, metadata: { prompt }, expiresAt },
  });
}

function roundTo(n: number, step: number): number {
  return Math.round(n / step) * step;
}
