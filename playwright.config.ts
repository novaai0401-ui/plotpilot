import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright config.
 *
 * Used for live a11y + smoke tests against the running app. Not currently
 * used for full E2E flows (signup → dashboard → logout etc.) — those would
 * need a Supabase test project. For now we cover what's publicly reachable:
 * /, /login, /signup, /design.
 *
 * Run locally:
 *   npm run test:e2e
 *   npm run test:e2e -- --ui   # interactive
 *
 * In CI a separate job runs this — see .github/workflows/test.yml.
 */
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? "github" : "list",

  // Boot the production build for tests — matches what users see.
  // `next start` requires the build to already exist, so the CI job runs
  // `npm run build` first.
  webServer: {
    command: "npm run start",
    url: "http://127.0.0.1:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    stdout: "pipe",
    stderr: "pipe",
    env: {
      // Bare-minimum env so the prod build can boot without complaining about
      // missing secrets. Real CI sets these from secrets.
      DATABASE_URL: process.env.DATABASE_URL || "postgresql://fake:fake@localhost:5432/fake",
      NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL || "https://fake.supabase.co",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "fake-anon-key",
      ENCRYPTION_KEY: process.env.ENCRYPTION_KEY || "ci-test-key-do-not-use-in-production-32",
    },
  },

  use: {
    baseURL: "http://127.0.0.1:3000",
    // Reduce flake from slow startups; tighten later if real flake shows up.
    actionTimeout: 10_000,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },

  projects: [
    {
      name: "desktop-chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "mobile-pixel",
      use: { ...devices["Pixel 7"] },
    },
  ],
});
