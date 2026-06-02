/**
 * Next.js 14 instrumentation hook.
 *
 * Called once per process startup; dispatches to the right Sentry init file
 * based on which runtime we're in. Required by @sentry/nextjs v8+.
 *
 * Docs: https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

// `onRequestError` exists on @sentry/nextjs v8+ but isn't typed on the version
// installed here. We re-export it dynamically so Next picks it up at runtime;
// older SDKs simply won't have it and the export is undefined (harmless).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const onRequestError = ((await import("@sentry/nextjs")) as any).captureRequestError;
