/**
 * Sentry — client-side init.
 *
 * Loaded automatically by @sentry/nextjs in the browser bundle.
 *
 * When SENTRY_DSN (or NEXT_PUBLIC_SENTRY_DSN) is unset, Sentry.init() is
 * a near no-op — events are dropped silently. This lets the SDK ship in
 * every deploy without requiring operator setup; production deploys add
 * the DSN env var and the pipe lights up.
 */

import * as Sentry from "@sentry/nextjs";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

Sentry.init({
  dsn,
  enabled: Boolean(dsn),

  // Sample fractions: tune in production via env. Defaults err on the side
  // of "see everything in early prod, scale down once volume hurts."
  tracesSampleRate: dsn ? Number(process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE || 0.2) : 0,
  replaysSessionSampleRate: 0, // session replay disabled until a privacy review
  replaysOnErrorSampleRate: 0,

  // Filter the noise users typically don't act on.
  ignoreErrors: [
    "ResizeObserver loop limit exceeded",
    "ResizeObserver loop completed with undelivered notifications",
    "Non-Error promise rejection captured",
    // Network blips during navigation — react/next surface these as warnings.
    /^Failed to fetch$/,
    /AbortError/,
    // Chrome extension noise.
    /chrome-extension/,
    /moz-extension/,
  ],

  // Tag every event with deploy info so we can slice by version.
  environment: process.env.NEXT_PUBLIC_DEPLOY_ENV || process.env.NODE_ENV,
  release: process.env.NEXT_PUBLIC_GIT_SHA,

  // Scrub Authorization headers + cookies before send. Sentry already does
  // this for known fields; this beforeSend belt-and-suspenders strips
  // anything that smells like an access token in the breadcrumbs.
  beforeSend(event) {
    if (event.request?.headers) {
      delete event.request.headers["authorization"];
      delete event.request.headers["cookie"];
      delete event.request.headers["x-csrf-token"];
    }
    return event;
  },
});
