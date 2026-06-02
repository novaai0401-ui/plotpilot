# Operations runbook

Tactical playbook for keeping the PlotBroker deployment healthy. Add new
sections as new outage patterns appear — the goal is "anyone on-call can
fix this without paging the original author."

## Contents

- [Pre-flight: environment health check](#pre-flight)
- [PWA / service-worker verification](#pwa-verification)
- [Observability: where errors show up](#observability)
- [Common incidents](#common-incidents)
  - [WhatsApp webhook 5xx](#whatsapp-webhook-5xx)
  - [Razorpay webhook stops delivering](#razorpay-webhook)
  - [Email not arriving](#email-not-arriving)
  - [Build fails after `npm install`](#build-fails)
  - [Dev server throws `options.factory` undefined after a build](#stale-next-cache)
  - [Account deletion needs auditing](#account-deletion-audit)

## Pre-flight

Run before every production deploy. Each step should exit zero.

```bash
# 1. Type check
npx tsc --noEmit

# 2. Lint + tests
npm run test

# 3. Production build
npm run build

# 4. RLS enforcement (needs DATABASE_URL pointing at the deploy target)
npm run check:rls

# 5. Smoke-test integration suite (CI does this automatically)
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/plot_broker_test \
  npx vitest run tests/integration
```

CI runs all of these on every PR — see `.github/workflows/test.yml`.

## PWA verification

The service worker (`/sw.js`) is built by `next-pwa`. To verify a release
caches and falls back correctly:

1. **Install path**
   - `npm run build && npm run start`
   - Open Chrome → DevTools → Application → Service Workers
   - Confirm `/sw.js` is registered and shows status `activated`
   - Confirm DevTools → Application → Manifest shows the right `start_url`
     and `theme_color`
2. **Offline path**
   - Online: navigate to `/dashboard`, `/dashboard/plots`, `/dashboard/visits`
     — these now sit in the cache
   - DevTools → Network → tick `Offline`
   - Reload — cached pages render instantly
   - Navigate to a route you didn't visit while online (e.g. `/dashboard/audit-log`)
     — `/offline` page renders with retry button
3. **Install-to-OS path**
   - Click the address bar's install icon (or Chrome menu → "Install PlotBroker")
   - Close the browser entirely
   - Launch from the OS app drawer — should cold-start to `/dashboard` even
     with network disabled
4. **Update path** (verifies new SW takes over without manual reload)
   - Deploy a new build
   - In the running PWA: trigger a navigation
   - DevTools → Application → Service Workers should show the new SW as
     "waiting" then "activated" within ~5s (next-pwa has `skipWaiting: true`)

If any step fails, file an issue with the DevTools screenshot. The most
common failure mode is a precache manifest referencing a stale chunk hash
after a hot deploy — fix is a hard refresh + new SW install.

## Accessibility baseline

Surfaces touched in the Round 8/10 a11y pass:

| Surface | What's wired |
|---|---|
| Root layout | Skip-to-content link, `<html lang>` from locale cookie, `suppressHydrationWarning` on theme toggle |
| `/login`, `/signup` | `noValidate` forms to avoid native tooltip conflicts with Tkx error states; `aria-live="polite"` regions wrap error alerts so they announce when set |
| Dashboard sidebar | `aria-label="Dashboard sidebar"` + `aria-label="Account and preferences"` on landmarks; nav items get `aria-current="page"` for the active route |
| Theme picker | `role="radiogroup"` with `aria-busy` while saving |
| Locale picker | `aria-busy` while reloading server tree |
| Danger zone | Slug input has real visible label + live `error` state via TkxInput's invalid path; delete button has `aria-describedby` pointing at the unmet-criteria text |

Live a11y tests now run in CI — `tests/e2e/axe.spec.ts` exercises `/`, `/login`,
`/signup`, `/design`, and `/offline` against axe-core (WCAG 2.1 AA + best
practices), failing the run on any serious/critical violation. Tests run
on both desktop Chromium and Pixel 7 viewports — see `playwright.config.ts`.

Color-contrast rule is currently disabled in the axe config until brand
tokens are audited at AAA; the underlying tekivex-ui components claim AAA
but we don't yet enforce it on our copy + brand usage.

The architect wizard (`components/architect/requirements-wizard.tsx`)
got an explicit keyboard pass in Round 11:

- Inputs wrapped in a `<form>` so Enter advances steps (or Generates on
  the last step); Back/Next have explicit `type="button"` to prevent
  accidental form submission
- `stepHeadingRef` catches focus on every step change so keyboard users
  land on the new content instead of staying on the Next button
- `aria-live="polite"` hidden heading announces "Step N of M: …" to AT
- Generate button has `aria-describedby` pointing at the criteria text
  when it's disabled, so screen-reader users hear why they're stuck

What's still deferred:

- Mobile screen-reader testing (TalkBack on Android, VoiceOver on iOS)
- Color-contrast audit of the brand teal tokens against AAA thresholds
- Authenticated routes (`/dashboard/*`, `/portal/*`) — would need a
  Supabase test project to seed sessions; currently we only assert a11y
  on public routes

## Observability

| Event | Lands in |
|---|---|
| Unhandled exception (server) | Sentry (project `plot-broker`) + Vercel function logs |
| Unhandled exception (client) | Sentry + browser console |
| Webhook payload (signed) | `WebhookEvent` table (Prisma) — 90-day retention via cron |
| Account deletion | stderr structured log (`audit: account.deleted`) + Sentry breadcrumb |
| RLS bypass attempt | Postgres logs (Supabase dashboard → Logs) |
| Rate-limit hit | Upstash Redis hit count + Sentry breadcrumb |

Sentry config is in `sentry.{client,server,edge}.config.ts`. The SDK is a
no-op when `SENTRY_DSN` is unset, so dev deploys are silent.

## Common incidents

### WhatsApp webhook 5xx

**Symptom**: Meta dashboard shows `/api/webhooks/whatsapp` returning 5xx;
broker reports message statuses stuck on "sent".

1. Check Sentry for the exception — most common is a Prisma schema mismatch
   after a recent migration.
2. Reproduce locally: copy the failing payload from Meta dashboard →
   POST it to `/api/webhooks/whatsapp` with the documented HMAC header.
3. The integration suite (`tests/integration/whatsapp-webhook.test.ts`)
   covers the documented payload shapes — add the failing one to that file
   first, then fix.
4. Replay protection: failed deliveries DO mark the event in `WebhookEvent`,
   so a fix-then-replay needs `DELETE FROM "WebhookEvent" WHERE externalId = ...`
   first or Meta's retry will be silently ignored.

### Razorpay webhook

**Symptom**: a subscription doesn't reflect on the org's billing page.

1. Razorpay dashboard → Webhooks → check delivery status. Re-trigger from there.
2. Signature mismatches show 401 in our logs — verify `RAZORPAY_WEBHOOK_SECRET`
   matches the value set in the Razorpay dashboard's webhook config.
3. Replay protection same as above — see `WebhookEvent.externalId`.
4. Plan-id mapping: `lib/billing/razorpay.ts` → `planFromRazorpayPlanId`.
   Two env vars (`RAZORPAY_PLAN_ID_PRO`, `RAZORPAY_PLAN_ID_ENTERPRISE`)
   must match the live plan ids; mismatch = subscription gets `plan: free`.

### Email not arriving

See `docs/email-deliverability.md` for the SPF/DKIM/DMARC setup. Quick check:

```bash
# Verify Resend has the domain
curl -s -H "Authorization: Bearer $RESEND_API_KEY" \
  https://api.resend.com/domains | jq .

# Check a recent send
curl -s -H "Authorization: Bearer $RESEND_API_KEY" \
  https://api.resend.com/emails/<email-id> | jq .
```

### Build fails

`tekivex-ui`'s ESM/CJS dual-build can desync after a major bump. If you see
`Cannot read properties of undefined (reading 'call')` at webpack module-
factory time, check `transpilePackages: ["tekivex-ui"]` is still in
`next.config.mjs` (the Sentry wrap is sensitive to ordering).

### Stale .next cache

**Symptom**: `npm run dev` (right after `npm run build`, or vice versa)
throws on first page load:

```
TypeError: Cannot read properties of undefined (reading 'call')
    at options.factory (.../webpack.js:...)
```

Server log also shows webpack-cache warnings about `./vendor-chunks/*`
paths that "don't lead to expected result". `app-build-manifest.json` is
absent (or out of sync) and chunk IDs resolve to undefined.

**Cause**: dev was reading a chunk graph webpack-stamped by the prior
`next build`. Build and dev write incompatible artifacts into the same
output directory; whoever ran last wins and the other one explodes.

**Prevention (already wired up)**: `next.config.mjs` sets
`distDir` based on `NODE_ENV` — `next dev` writes to `.next-dev`,
`next build` / `next start` use `.next`. Both are in `.gitignore`.
You should never see this on a fresh checkout.

**If you still see it** (e.g. someone hand-set `distDir` or the env
override got bypassed):

```powershell
# Nuke both output dirs and webpack's persistent cache
Remove-Item -Recurse -Force .next, .next-dev -ErrorAction SilentlyContinue
npm run dev
```

Do NOT just delete `app-build-manifest.json` — webpack's pack cache
under `.next/cache/webpack/` also holds the stale graph and will re-emit
the same broken state.

### Account deletion audit

Each successful deletion emits a structured stderr line and a Sentry
`captureMessage` breadcrumb tagged `audit: account.deleted`. To enumerate
deletions in the last 30 days:

```bash
# Sentry → Issues → filter by `audit:account.deleted`
# Or via the API:
curl -s -H "Authorization: Bearer $SENTRY_AUTH_TOKEN" \
  "https://sentry.io/api/0/projects/$SENTRY_ORG/$SENTRY_PROJECT/events/?query=audit:account.deleted+age:-30d" \
  | jq '.[] | { at: .dateCreated, org: .tags[] | select(.key=="orgId") | .value }'
```

If a customer requests the contents of an audit record (DPDPA right-to-know),
the `extra` field on each event holds the full audit line.
