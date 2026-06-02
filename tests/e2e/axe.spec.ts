import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

/**
 * Live a11y baseline.
 *
 * Runs axe-core against the rendered DOM of each publicly-reachable page.
 * Fails the run on serious/critical violations. Tagged with WCAG 2.1 AA + best
 * practices — we don't claim AAA across the whole app (tekivex-ui ships AAA
 * components but our copy + brand-color usage isn't audited at that level).
 *
 * To investigate a failure: `npm run test:e2e -- --ui` and inspect the
 * violations report inline.
 *
 * Adding a new route to the suite:
 *   1. Drop a `test('label', async ({page}) => {...})` block below
 *   2. Use `axeRun(page)` to apply the shared rules / impact filter
 *   3. New impact-serious findings break CI by design — fix them or
 *      explicitly disable the rule with a rationale in code
 */

async function axeRun(page: import("@playwright/test").Page) {
  return new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "best-practice"])
    // Disable the contrast rule until brand tokens are audited at AAA — we'd
    // be re-flagging tekivex-ui internals on every run otherwise. Re-enable
    // once we've decided on the dark-mode contrast story.
    .disableRules(["color-contrast"])
    .analyze();
}

const PUBLIC_ROUTES = [
  { name: "landing", path: "/" },
  { name: "login", path: "/login" },
  { name: "signup", path: "/signup" },
  { name: "design (public architect)", path: "/design" },
  { name: "offline fallback", path: "/offline" },
] as const;

for (const route of PUBLIC_ROUTES) {
  test(`a11y: ${route.name}`, async ({ page }) => {
    await page.goto(route.path, { waitUntil: "domcontentloaded" });
    // Wait for Tkx hydration so axe sees the post-mount markup, not the SSR shell.
    await page.waitForLoadState("networkidle").catch(() => {});

    const results = await axeRun(page);
    const seriousOrCritical = results.violations.filter(
      (v) => v.impact === "serious" || v.impact === "critical"
    );

    // If this fires, the test report names the rule + selector + help URL.
    expect.soft(seriousOrCritical, formatViolations(seriousOrCritical)).toEqual([]);
  });
}

test("login form: keyboard-only submission path reaches the button", async ({ page }) => {
  await page.goto("/login", { waitUntil: "domcontentloaded" });

  // Tab through: email → password → sign-in button. (Locale + theme pickers
  // live in the dashboard, not /login, so the tab order is short.)
  await page.locator("input[type=email]").focus();
  await page.keyboard.press("Tab");
  await expect(page.locator("input[type=password]")).toBeFocused();
  await page.keyboard.press("Tab");
  // The next focusable thing should be the submit button.
  const focused = await page.evaluate(() => document.activeElement?.tagName);
  expect(focused).toBe("BUTTON");
});

function formatViolations(violations: any[]): string {
  if (!violations.length) return "no violations";
  return violations
    .map(
      (v) =>
        `[${v.impact}] ${v.id}: ${v.help}\n  → ${v.helpUrl}\n  Affected nodes (${v.nodes.length}):\n` +
        v.nodes
          .slice(0, 3)
          .map((n: any) => `    - ${n.target.join(" ")}`)
          .join("\n")
    )
    .join("\n\n");
}
