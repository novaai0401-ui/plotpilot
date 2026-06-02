import nextPwa from "next-pwa";
import { withSentryConfig } from "@sentry/nextjs";

const withPWA = nextPwa({
  dest: "public",
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === "development",
});

// Separate build/dev output directories. `next dev` reusing a directory
// last written by `next build` produces hard-to-debug webpack errors
// (`Cannot read properties of undefined (reading 'call')` at options.factory)
// because dev reads chunk graphs stamped for production. Keep them apart.
// See OPERATIONS.md → "Stale .next cache after switching build ↔ dev".
const distDir = process.env.NODE_ENV === "development" ? ".next-dev" : ".next";

/** @type {import('next').NextConfig} */
const nextConfig = {
  distDir,
  reactStrictMode: true,
  experimental: {
    serverActions: { bodySizeLimit: "2mb" },
    // Native addons (`.node` binaries) cannot be parsed by webpack. Keep them as
    // runtime requires on the server. @resvg/resvg-js ships a per-platform binary
    // for SVG rasterization in the PDF export pipeline.
    serverComponentsExternalPackages: ["@resvg/resvg-js"],
  },
  // tekivex-ui ships both ESM and CJS but Next's default resolution picks the wrong
  // one in some contexts, producing webpack "Cannot read properties of undefined
  // (reading 'call')" at module-factory time. Transpiling it through Next's own
  // pipeline normalizes everything to the build's target format.
  transpilePackages: ["tekivex-ui"],
};

// Sentry wrapping — applied AFTER the PWA wrap so the service worker
// includes the Sentry SDK chunk. Source-map upload only runs when an
// SENTRY_AUTH_TOKEN is present (CI builds); local builds skip silently.
const sentryWebpackOptions = {
  silent: !process.env.SENTRY_AUTH_TOKEN,
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  // Don't fail the build if the upload step errors — keeps deploys robust
  // when Sentry is mid-incident.
  errorHandler: (err) => {
    // eslint-disable-next-line no-console
    console.warn(`[sentry] source-map upload skipped: ${err?.message || err}`);
  },
};

const sentrySdkOptions = {
  // Auto-instrument fetch / route handlers / RSC errors.
  hideSourceMaps: true,
  // Tunnel browser → /monitoring so ad-blockers don't drop events.
  tunnelRoute: "/monitoring",
  // Tree-shake unused @sentry/* features for a smaller client bundle.
  disableLogger: true,
};

const wrapped = process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN
  ? withSentryConfig(withPWA(nextConfig), sentryWebpackOptions, sentrySdkOptions)
  : withPWA(nextConfig);

export default wrapped;
