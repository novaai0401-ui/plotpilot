/**
 * Sentry — edge runtime init.
 *
 * Loaded by middleware.ts and any route handler with `export const runtime = "edge"`.
 * The edge SDK is a slim subset of @sentry/nextjs that runs under V8 isolates
 * without Node APIs.
 */

import * as Sentry from "@sentry/nextjs";

const dsn = process.env.SENTRY_DSN;

Sentry.init({
  dsn,
  enabled: Boolean(dsn),
  tracesSampleRate: dsn ? Number(process.env.SENTRY_TRACES_SAMPLE_RATE || 0.1) : 0,
  environment: process.env.SENTRY_ENVIRONMENT || process.env.VERCEL_ENV || process.env.NODE_ENV,
  release: process.env.SENTRY_RELEASE || process.env.VERCEL_GIT_COMMIT_SHA,
});
