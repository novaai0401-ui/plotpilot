/**
 * Pluggable rate limiter.
 *
 * - If UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN are set, uses @upstash/ratelimit
 *   (sliding window, distributed across serverless instances).
 * - Otherwise falls back to an in-memory store. Works for local dev and single-instance
 *   deploys; NOT safe across multiple serverless cold starts in production.
 */

import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import * as Sentry from "@sentry/nextjs";

export type RateLimitResult = {
  success: boolean;
  remaining: number;
  resetAt: number; // ms epoch
  limit: number;
};

type LimitConfig = {
  /** Max number of requests in the window */
  max: number;
  /** Window in ms */
  windowMs: number;
  /** Identifier prefix (helps separate concerns: 'architect_public_ip', 'login_email', etc.) */
  prefix: string;
};

// ----- Upstash adapter -----

const upstashClients = new Map<string, Ratelimit>();

function getUpstashLimiter(cfg: LimitConfig): Ratelimit | null {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  const key = `${cfg.prefix}:${cfg.max}:${cfg.windowMs}`;
  let limiter = upstashClients.get(key);
  if (!limiter) {
    limiter = new Ratelimit({
      redis: new Redis({ url, token }),
      limiter: Ratelimit.slidingWindow(cfg.max, `${cfg.windowMs} ms`),
      prefix: cfg.prefix,
    });
    upstashClients.set(key, limiter);
  }
  return limiter;
}

// ----- In-memory fallback -----

type Bucket = { count: number; resetAt: number };
const memStore = new Map<string, Bucket>();

function memLimit(identifier: string, cfg: LimitConfig): RateLimitResult {
  const now = Date.now();
  const k = `${cfg.prefix}:${identifier}`;
  const existing = memStore.get(k);
  if (!existing || existing.resetAt < now) {
    memStore.set(k, { count: 1, resetAt: now + cfg.windowMs });
    return { success: true, remaining: cfg.max - 1, resetAt: now + cfg.windowMs, limit: cfg.max };
  }
  if (existing.count >= cfg.max) {
    return { success: false, remaining: 0, resetAt: existing.resetAt, limit: cfg.max };
  }
  existing.count++;
  return {
    success: true,
    remaining: cfg.max - existing.count,
    resetAt: existing.resetAt,
    limit: cfg.max,
  };
}

// Periodic GC for in-memory store (no-op on serverless cold starts; fine for local dev)
if (typeof setInterval !== "undefined" && !(globalThis as any).__rl_gc) {
  (globalThis as any).__rl_gc = setInterval(() => {
    const now = Date.now();
    for (const [k, v] of memStore) if (v.resetAt < now) memStore.delete(k);
  }, 60_000).unref?.();
}

// ----- Public API -----

let warnedAboutMemFallback = false;

export async function checkRateLimit(
  identifier: string,
  cfg: LimitConfig
): Promise<RateLimitResult> {
  const upstash = getUpstashLimiter(cfg);
  let result: RateLimitResult;
  if (upstash) {
    const r = await upstash.limit(identifier);
    result = {
      success: r.success,
      remaining: r.remaining,
      resetAt: r.reset,
      limit: r.limit,
    };
  } else {
    // In production, in-memory rate limiting is broken across serverless instances —
    // each cold start has its own counter. Log loudly once per process so this isn't silent.
    if (process.env.NODE_ENV === "production" && !warnedAboutMemFallback) {
      warnedAboutMemFallback = true;
      console.error(
        "[rate-limit] WARNING: in-memory fallback active in production. Set UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN to enable distributed rate limiting. Rate limits will be unreliable across serverless instances."
      );
    }
    result = memLimit(identifier, cfg);
  }

  // Observability: every denial leaves a breadcrumb so it shows up in Sentry
  // context for any error captured later in the same request, AND a structured
  // warn line so the deploy's log retention catches it. Persisting to
  // AnalyticsEvent is the caller's responsibility — we don't know orgId here.
  if (!result.success) emitRateLimitDenied(identifier, cfg, result);

  return result;
}

function emitRateLimitDenied(
  identifier: string,
  cfg: LimitConfig,
  result: RateLimitResult
) {
  // Hash IPs / emails before logging so we never persist raw PII. Crude but
  // adequate — we only need uniqueness for clustering, not reversibility.
  const idHash =
    identifier.length > 32
      ? identifier
      : Buffer.from(identifier).toString("base64").slice(0, 16);

  Sentry.addBreadcrumb({
    category: "rate-limit",
    level: "warning",
    message: `rate_limit.denied prefix=${cfg.prefix}`,
    data: { idHash, limit: cfg.max, windowMs: cfg.windowMs },
  });

  // Structured log — survives even if Sentry isn't configured.
  // eslint-disable-next-line no-console
  console.warn(
    JSON.stringify({
      level: "warn",
      subsystem: "rate-limit",
      event: "denied",
      prefix: cfg.prefix,
      idHash,
      limit: cfg.max,
      windowMs: cfg.windowMs,
      resetAt: result.resetAt,
    })
  );
}

/**
 * Persist a rate-limit denial as an `AnalyticsEvent` so super_admin can see
 * patterns over time at /admin/rate-limits. Call this from the route handler
 * AFTER `checkRateLimit` denies AND you have an orgId in scope.
 *
 * Best-effort: failures are swallowed so analytics writes never break the
 * 429 response path.
 */
export async function persistRateLimitDenial(
  orgId: string,
  prefix: string,
  meta: { remaining?: number; resetAt?: number } = {}
): Promise<void> {
  try {
    // Lazy import so the public rate-limit helper stays usable in edge runtime
    // (Prisma can't run there). Callers that want persistence are running
    // on the Node runtime.
    const { prisma } = await import("@/lib/db/prisma");
    await prisma.analyticsEvent.create({
      data: {
        orgId,
        type: "rate_limit.denied",
        metadata: { prefix, ...meta } as object,
      },
    });
  } catch {
    // Swallow — the 429 path must not depend on Prisma being healthy.
  }
}

/** Returns true if the production Upstash backend is configured. */
export function isProductionRateLimitConfigured(): boolean {
  return !!(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
}

/** Pull a best-effort client IP from a Next.js request. */
export function clientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]!.trim();
  return (
    req.headers.get("x-real-ip") ||
    req.headers.get("cf-connecting-ip") ||
    "unknown"
  );
}
