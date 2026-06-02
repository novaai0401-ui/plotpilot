/**
 * Sentry — server-side init (Node runtime).
 *
 * Loaded by the Next.js instrumentation hook in node-runtime contexts:
 * Server Components, Route Handlers running on Node, cron jobs.
 *
 * When SENTRY_DSN is unset, Sentry.init() is a near no-op — events are
 * dropped silently. Operator sets SENTRY_DSN to light up the pipe.
 */

import * as Sentry from "@sentry/nextjs";

const dsn = process.env.SENTRY_DSN;

Sentry.init({
  dsn,
  enabled: Boolean(dsn),

  tracesSampleRate: dsn ? Number(process.env.SENTRY_TRACES_SAMPLE_RATE || 0.1) : 0,

  environment: process.env.SENTRY_ENVIRONMENT || process.env.VERCEL_ENV || process.env.NODE_ENV,
  release: process.env.SENTRY_RELEASE || process.env.VERCEL_GIT_COMMIT_SHA,

  // Server breadcrumbs frequently include req.body — strip secrets before send.
  beforeSend(event) {
    if (event.request?.headers) {
      delete event.request.headers["authorization"];
      delete event.request.headers["cookie"];
      delete event.request.headers["x-razorpay-signature"];
      delete event.request.headers["x-hub-signature-256"];
      delete event.request.headers["x-csrf-token"];
    }
    return event;
  },

  // Don't report expected 4xx flow — only actual exceptions.
  ignoreErrors: [
    "NEXT_REDIRECT", // next/navigation redirect() throws this internally
    "NEXT_NOT_FOUND",
  ],
});
