# PlotBroker — Multi-tenant SaaS for Real Estate Brokers

A web + PWA platform for plot brokers to invite clients, schedule visits, message via WhatsApp, and track analytics.

## Features

- **Multi-tenant** — every brokerage is an isolated `Organization`. All queries filter by `orgId`.
- **Roles** — `super_admin` · `broker_admin` · `broker_agent` · `client`.
- **Invitations** — tokenized signup links sent via WhatsApp.
- **Visits** — schedule, remind, mark completed/cancelled/no-show, capture feedback.
- **WhatsApp (configurable per org):**
  - `deeplink` mode → `wa.me/<number>?text=...` opens in WhatsApp, broker clicks Send (free, no API).
  - `business_api` mode → automated send via Meta WhatsApp Cloud API.
  - `hybrid` mode → broker picks per message in the UI.
- **Analytics** — 30-day dashboard: invitations, conversion %, visits, messages, daily timeline (Recharts).
- **PWA** — installable on mobile home screen, offline fallback.

## UI library

The app uses [`tekivex-ui`](https://www.npmjs.com/package/tekivex-ui) for its design-system primitives. The CSS is imported once in `app/globals.css` via `@import "tekivex-ui/styles"`; the runtime is wired in `components/providers.tsx` (`ThemeProvider` + `TkxToastProvider`, auto color-scheme).

Key surfaces using Tkx primitives:
- **Wizard** (`components/architect/requirements-wizard.tsx`) — `TkxStepper`, `TkxInput`, `TkxSelect`, `TkxNumberInput`, `TkxCheckbox`, `TkxButton` (with `isLoading`/`glow`), `TkxAlert`, `TkxCard`, `TkxBadge`, `useToast`
- **Usage dashboard** (`app/dashboard/usage/page.tsx`, `components/usage/*`) — `TkxCard`, `TkxStatistic`, `TkxTable` (typed `ColumnDef`), `TkxAlert`, `TkxBadge`
- **Inbox** (`app/dashboard/inbox/page.tsx`, `components/inbox/*`) — `TkxCard` (with `borderLeft` for unread), `TkxBadge` (pulse for unread count), `TkxEmpty`, `TkxButton`
- **Upgrade modal** (`components/billing/upgrade-modal.tsx`) — `TkxModal` (portal-rendered), `TkxButton.isLoading`, `TkxAlert`, `TkxBadge`, `useToast` for transient feedback
- **Manage subscription** — same Tkx pattern; success/cancel feedback via `useToast` instead of `alert()`

Legacy surfaces (clients table, plot CRUD, settings form, admin pages, broker dashboard sidebar) still use Tailwind primitives — they're functional and were not refactored to keep this pass focused on the highest-traffic flows. Migrate incrementally by replacing native `<input>` → `TkxInput`, `<button>` → `TkxButton`, table markup → `TkxTable`, etc.

## Running the app

This is a single Next.js app — there's **no separate client and server process**. Next.js serves the React UI and API routes from the same Node process. The commands below are everything you need to start, build, and operate the app.

### Development (dev server with hot reload)

```powershell
# 1. install deps (first time only)
npm install

# 2. generate the Prisma client + push the schema to your Supabase Postgres
npm run db:generate
npm run db:push

# 3. (optional) seed a demo org with sample data
npm run db:seed

# 4. start the dev server — UI + API on http://localhost:3000
npm run dev
```

Hot-reload is enabled; edits to any file under `app/`, `components/`, or `lib/` reload the browser automatically.

> **Dev and build write to different output directories.** `next dev` outputs to `.next-dev/`; `next build` / `next start` use `.next/`. Both are gitignored. This is deliberate — sharing one directory between the two modes produces webpack `options.factory` undefined errors because the chunk graph is stamped differently per mode. See [OPERATIONS.md → Stale .next cache](OPERATIONS.md#stale-next-cache).

> Windows tip: if `npm run dev` fails with `EPERM ... rename query_engine-windows.dll.node` on a second run, a previous Node process is still holding the Prisma DLL. Stop it from your task manager (or `Get-Process node | Stop-Process -Force` in PowerShell) and try again.

### Production (build once, serve compiled output)

```powershell
# 1. build the production bundle (Server Components + client chunks + static assets)
npm run build

# 2. start the production server — same port, no hot reload, ~10× faster
npm run start
```

Same `http://localhost:3000`. Deploy this to Vercel by pushing to GitHub and letting Vercel auto-detect — these are the same two commands Vercel runs.

### Other useful commands

```powershell
npm run lint              # ESLint (warns only — no formatter)
npm run test              # Vitest — 70 unit tests, ~2 sec, no DB needed
npm run test:watch        # Watch mode — reruns relevant tests on file save
npm run test:coverage     # HTML coverage report at coverage/index.html
npx prisma studio         # browse the DB in a local UI on http://localhost:5555
npx prisma migrate dev    # use migrate instead of db:push when working in a team
```

### Tests

70 unit tests in `tests/` covering pure logic only — no DB, no live API calls, no React rendering:

| Module | Coverage |
|---|---|
| `lib/architect/rules.ts` | 14 tests — generateBrief residential/commercial/mixed, FAR warnings, per-room cost multipliers, bedroom distribution, master-bedroom placement, multi-unit apartments |
| `lib/architect/requirements.ts` | 9 tests — Zod schema acceptance & rejection, buildableFootprint setbacks, maxBuiltUpSqft math |
| `lib/architect/design-cache.ts` | 11 tests — narrativeHash/renderHash determinism, sensitivity to relevant fields, insensitivity to irrelevant ones (caught a real bug in canonicalization here) |
| `lib/crypto/encrypt.ts` | 8 tests — round-trip, random IV uniqueness, tamper detection, format guards |
| `lib/geo/distance.ts` | 8 tests — Haversine against known city distances within 1%, symmetry, cityMatches substrings |
| `lib/whatsapp/*` | 6 tests — Deeplink URL building & encoding, BusinessApiProvider with mocked fetch (200/401/network error) |
| `lib/billing/razorpay.ts` | 9 tests — HMAC signature verification (valid/tampered/missing/length mismatch), plan-id mapping |
| `lib/plans.ts` | 5 tests — capability table consistency, monotonic caps across tiers |

CI runs them on every push via `.github/workflows/test.yml`, plus a `npm run build:ci` check to catch type and import errors before merge.

### Edge-runtime imports are a build error

`middleware.ts` (and any `runtime: "edge"` route) runs on the V8-isolate edge
runtime, **not** Node. Importing a Node built-in like `node:crypto`, `fs`, or
`stream` from edge-runtime code makes Next print a warning like:

> A Node.js module is loaded ('crypto' at line 3) which is not supported in the Edge Runtime.

…and then exits **0**. The bundle ships, and every request 500s the moment the
import is touched. This has bitten us twice. To stop it shipping a third time,
CI runs `npm run build:ci` instead of `npm run build` — that wrapper
(`scripts/check-edge-runtime.ts`) tees `next build` output and exits non-zero
if it sees the warning. Run it locally before pushing if you've touched
`middleware.ts` or anything it imports. Fix path: swap the Node built-in for a
WebCrypto / Fetch-API equivalent (`crypto.getRandomValues`, `fetch`, etc.) or
move the offending code off the edge runtime.

### Visit reminder + lead followup crons (production only)

The two daily/hourly cron jobs (`/api/cron/visit-reminders`, `/api/cron/lead-followups`) are configured in `vercel.json` and activate automatically when deployed to Vercel. Locally, you can fire them manually:

```powershell
curl "http://localhost:3000/api/cron/visit-reminders?secret=$env:CRON_SECRET"
curl "http://localhost:3000/api/cron/lead-followups?secret=$env:CRON_SECRET"
```

## Stack

| Layer    | Choice                                            |
|----------|---------------------------------------------------|
| Frontend | Next.js 14 App Router · TypeScript · Tailwind · tekivex-ui (primary design system) |
| Auth     | Supabase Auth (email/password)                    |
| DB       | PostgreSQL (Supabase) via Prisma                  |
| WhatsApp | Custom provider abstraction (deeplink + Cloud API)|
| PWA      | next-pwa                                          |
| Charts   | Recharts                                          |

## Setup

### 1. Install
```powershell
npm install
```

### 2. Create a Supabase project
- Sign up at https://supabase.com
- Project Settings → Database → copy the connection string
- Project Settings → API → copy URL + anon key + service role key

### 3. Configure env
Copy `.env.example` to `.env` and fill in values:
```
DATABASE_URL=...
DIRECT_URL=...
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 4. Initialize the database
```powershell
npm run db:generate
npm run db:push
npm run db:seed   # optional, creates a demo org
```

### 5. Run dev server
```powershell
npm run dev
```
Open http://localhost:3000

## Folder layout

```
app/
  (auth)/login, signup        — auth pages
  dashboard/                  — broker admin (protected: broker_admin / broker_agent)
    clients, plots, invitations, visits, messages, analytics, settings
  portal/                     — client portal (protected: client)
    visits, messages, profile
  api/
    auth/provision            — creates org + user after Supabase sign-up
    messages/send             — sends WhatsApp via configured provider
  offline/                    — PWA offline fallback

lib/
  auth/                       — Supabase clients + role guards
  db/                         — Prisma singleton
  whatsapp/                   — provider abstraction
    types.ts                  — WhatsAppProvider interface
    deeplink-provider.ts      — wa.me URLs
    business-api-provider.ts  — Meta Cloud API
    index.ts                  — resolveWhatsAppProvider(orgId, preference)
    send-and-log.ts           — single entry point: send + log Message + emit analytics event

components/                   — shared React components
prisma/
  schema.prisma               — multi-tenant data model
  seed.ts                     — demo data
middleware.ts                 — Supabase session refresh + protected route gating
```

## Multi-tenant safety

Every business query filters by `orgId`, and `requireUser()` returns the caller's `orgId`. Defense in depth:
- App layer: all data-access wraps `prisma.X.findFirst({ where: { ..., orgId: user.orgId } })`.
- Database layer (recommended for production): enable **Supabase RLS policies** on every table — e.g. `USING (org_id = current_setting('app.current_org_id')::text)`. Set the GUC in a Postgres connection wrapper using the Supabase JWT claim.

## WhatsApp setup notes

**Deep link only:** zero setup. Works immediately.

**Business API:** in Settings → WhatsApp, set Mode to `business_api` or `hybrid`, then enter `phoneNumberId` and `accessToken` from Meta for Developers → your WhatsApp app. Per-org credentials, so each brokerage uses their own Meta Business account.

## Hardening

The following are wired up out of the box — read each section before going to production:

### Server-side session check
`/api/auth/provision` reads `authId` from the Supabase session cookie, not the request body. Anonymous calls are rejected with 401, double-provisioning with 409.

### WhatsApp token encryption
Access tokens are encrypted at rest using AES-256-GCM (see `lib/crypto/encrypt.ts`). Set `ENCRYPTION_KEY` in `.env`:
```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```
On Settings → WhatsApp, existing tokens show as `******` — submitting that sentinel keeps the current value; clearing the field removes it.

### Row-Level Security (Supabase)
After `npm run db:push`, run:
```powershell
psql $env:DATABASE_URL -f prisma/migrations/rls/001_enable_rls.sql
```
This enables RLS on every tenant table. To use it from app code, wrap queries in `withOrg(orgId, tx => ...)` from `lib/db/with-org.ts` — it sets `app.current_org_id` for the duration of the transaction. The `service_role` key still bypasses RLS, so cron jobs and webhooks continue to work.

## Background jobs

### Visit reminders cron
`vercel.json` schedules `/api/cron/visit-reminders` daily at 09:00. It finds tomorrow's scheduled visits and sends WhatsApp reminders via each org's configured provider. Idempotent — won't double-send within 12 hours. Protected by `CRON_SECRET` (set in env; Vercel auto-attaches `Authorization: Bearer $CRON_SECRET`).

Test locally:
```powershell
curl "http://localhost:3000/api/cron/visit-reminders?secret=YOUR_CRON_SECRET"
```

### WhatsApp webhook
`/api/webhooks/whatsapp` handles Meta Cloud API callbacks:
- **GET** — verification handshake (`hub.verify_token` must equal `WHATSAPP_VERIFY_TOKEN`).
- **POST** — status events (sent/delivered/read/failed) update `Message.status` by `externalRef`. Inbound client replies are stored as `Message` rows so brokers see them in the dashboard.

Configure in Meta for Developers → WhatsApp → Configuration → Callback URL = `https://yourdomain.com/api/webhooks/whatsapp`, Verify Token = your `WHATSAPP_VERIFY_TOKEN`. Subscribe to `messages` and `message_status` fields.

> **TODO for production:** add HMAC validation using `X-Hub-Signature-256`. See the comment in `route.ts`.

## AI architect (building design generator)

A wizard that captures requirements (plot, rooms, style, amenities) and auto-generates:
1. **Deterministic design brief** — room list per floor with dimensions, FAR check, materials, MEP recommendations, code notes, cost estimate.
2. **2D floor plan SVGs** — one per floor, schematic layout with labels and dimensions.
3. **AI concept render image** — exterior building render via Replicate (Flux Schnell).
4. **LLM narrative** — design rationale via Claude, with personalized recommendations.

### Four entry points (one shared wizard)
| URL | Source | Who |
|---|---|---|
| `/design` | `public_lead` | Anonymous visitors. Captures name + phone at the end as a lead. |
| `/dashboard/plots/[id]/design` | `broker` | Broker designing for a specific plot. |
| `/dashboard/designs/new` | `standalone` | Broker designing without a plot link. |
| `/portal/design` | `client` | Logged-in client designs their own. |

All four submit to `POST /api/architect/generate`. Public leads land in **super_admin → Public leads** for follow-up.

### Architecture (lib/architect/)
```
requirements.ts        Zod schema + buildableFootprint() + maxBuiltUpSqft()
rules.ts               Pure rules engine: requirements → DesignBrief (rooms per floor, materials, MEP, code)
floor-plan-svg.ts      Greedy row-packing layout → one SVG per floor
llm.ts                 Claude narrative (Sonnet 4.5). Falls back to deterministic prose if no API key.
render-image.ts        Replicate (Flux-schnell) render. Falls back to Unsplash placeholder if no token.
```

Pipeline (`/api/architect/generate`):
1. Validate requirements (Zod, returns 400 on bad input)
2. Persist `BuildingDesign` row (`status: generating`)
3. Run rules engine + SVG render (sync, <1s)
4. Run LLM + image generation in parallel via `Promise.allSettled` (5-60s)
5. Update row to `status: ready`, emit `design.generated` analytics event
6. Return brief + narrative + SVGs + image URL

### Graceful degradation
- No `ANTHROPIC_API_KEY` → fallback narrative is auto-generated from the deterministic brief.
- No `REPLICATE_API_TOKEN` → image URL points to an Unsplash query placeholder.
- The page is fully functional with only the rules engine (which has no external deps).

### Cost
- LLM: ~$0.01 per design (Sonnet 4.5, ~1.5K tokens, with prompt cache for system prompt).
- Image: ~$0.003 per design (Flux Schnell).
- Both can be disabled via env vars for zero-cost operation.

### Exports
Every generated design has two download buttons in the viewer:

- **PDF** (`/api/architect/export/[id]/pdf`) — multi-page A4: cover w/ render + KPIs, narrative, one page per floor with the **on-screen SVG floor plan rasterized via @resvg/resvg-js** (matches the web view exactly) + room schedule (incl. per-room cost), specs appendix. Built with `pdf-lib` + `@resvg/resvg-js` — no native deps, no headless browser.
- **DXF** (`/api/architect/export/[id]/dxf`) — AutoCAD R12 format with one LAYER per floor. Footprint on a dashed `FOOTPRINT` layer, rooms as closed LWPOLYLINEs with TEXT labels. Units = feet. Importable in AutoCAD, LibreCAD, QCAD, DraftSight.

> Note: DXF is the open AutoCAD interchange format. True `.dwg` requires AutoCAD's proprietary writer or LibreDWG — most architects accept DXF.

### Per-room cost breakdown
The rules engine computes a cost estimate **per room** using `baseRate × area × roomMultiplier`. Kitchens (1.8×) and bathrooms (2.0×) cost more per sqft due to plumbing/electrical/tile; balconies (0.55×) and terraces (0.45×) cost less; lift shafts (2.2×) cost most. Surfaced in the on-screen room schedule and PDF, plus a floor total at the bottom of each floor table.

Multipliers live in `lib/architect/rules.ts → ROOM_COST_MULTIPLIER`. Tune regionally as needed.

### Broker notification on new public lead (geo-filtered)
The instant a public-lead design completes, every `super_admin` and `broker_admin` whose org's service area matches the lead is fan-out notified:
- **WhatsApp** via their org's configured provider (`sendAndLogWhatsApp`) — message includes lead name, phone, project type, and a link to view + claim.
- **Email** via Resend with the same info, plus WhatsApp deep-link to the lead's number and "Claim" CTA.

Fired async via `notifyBrokersOfPublicLead()` from `/api/architect/generate` (doesn't block response). Idempotent — `BuildingDesign.brokersNotifiedAt` is set after first run.

### Broker claim-lead flow
On `/admin/leads`, every unclaimed public lead has a **Claim + invite** button. One click:
1. Assigns `design.orgId` to the claiming broker's org
2. Creates an `Invitation` with the lead's name/phone/email and a fresh token
3. (Default-on) Sends a WhatsApp invite to the lead immediately, using the org's invite template with `{name}`, `{broker}`, `{org}`, `{design}`, `{link}` variables. Deep-link mode opens `wa.me` in a new tab; Business API mode sends silently.
4. Emits `lead.claimed` analytics event

API: `POST /api/leads/[id]/claim` · body `{ sendInvite?: boolean }` · gated to `broker_admin` / `broker_agent` / `super_admin`. Returns 409 if already claimed.

### Lead follow-up emails
Daily cron at 10:00 (`vercel.json` → `/api/cron/lead-followups`) finds public-lead designs generated 24-72h ago with an email captured and no prior follow-up sent. Sends a nurture email via Resend with:
- A link back to the design viewer
- The full design PDF attached
- An invitation to reply (brokers can pick up the thread)

Idempotent via `BuildingDesign.followupEmailSentAt`. The 24-72h window (vs strict "24h ago") tolerates cron outages. Set `RESEND_API_KEY` + `RESEND_FROM_EMAIL` to enable; without them, the cron logs and no-ops.

#### A/B subject testing + open/click tracking
Three subject variants are defined in `lib/email/templates.ts → SUBJECT_VARIANTS`. The variant for a given lead is picked deterministically by hashing the design id, so the same lead always gets the same subject (honest measurement).

Tracking:
- **Open** — 1×1 GIF served by `/api/email/track/[id]/open.gif`, sets `followupEmailOpenedAt` on first hit. (Lower bound — Apple Mail/Gmail proxies inflate.)
- **Click** — `/api/email/track/[id]/click?to=...` redirect endpoint with an open-redirect guard (only same-origin targets allowed). Sets `followupEmailClickedAt`.
- **Convert** — proxied by `claimedAt` on the same row (a broker claiming the lead).

Super-admin dashboard at **/admin/email-experiments** shows open/click/claim rates per variant. Variants with `sent: 0` still appear so you know what's configured. Edit `SUBJECT_VARIANTS` to add/remove variants; no migration needed.

Test locally:
```powershell
curl "http://localhost:3000/api/cron/lead-followups?secret=YOUR_CRON_SECRET"
```

### 3D viewer
Click "3D" on the floor-plans card. Three.js / `@react-three/fiber` extrudes each room from its 2D rectangle, stacks floors at 10ft height. Toggle floor visibility, orbit/zoom/pan, hover for room labels. Dynamic-imported so the heavy three.js bundle only loads when the user opens 3D.

### Rate limiting (public flow)
`/api/architect/generate` is rate-limited when `source: "public_lead"` to prevent abuse of the paid LLM + image APIs:
- **5 generations/hour per IP**
- **3 generations/day per phone**

Backend: `@upstash/ratelimit` if `UPSTASH_REDIS_REST_URL`/`UPSTASH_REDIS_REST_TOKEN` are set (production-safe across serverless instances); falls back to an in-memory store for local dev. Returns HTTP 429 with `X-RateLimit-*` headers + a JSON `retryAt` timestamp.

## Super admin

`/admin` is gated to `super_admin` role. Provides cross-org overview, organization list, per-org management (edit plan, delete). Promote a user with:
```sql
UPDATE "User" SET role = 'super_admin' WHERE email = 'you@example.com';
```

## Internationalization (English + Hindi)

The app ships English by default with a Hindi (हिंदी) translation. Locale picker lives in the dashboard sidebar and the landing-page header. Selection is persisted in a `plotbroker_locale` cookie (1 year).

### What's translated
- Sidebar nav (13 labels)
- Landing page (headline, subhead, 3 CTAs, 3 feature cards)
- Login form (8 strings)

### What's NOT translated (yet)
- Wizard (50+ form labels)
- Settings page
- Designs page, Inbox, Audit log, Usage, Team, Admin
- API error messages
- Email templates
- WhatsApp message templates

This is intentional — we proved the i18n bones work without auditing 200+ strings. To extend coverage:

1. Add the locale to `LOCALES` in `lib/i18n/dict.ts` if it's new.
2. Add `key: { en: "...", hi: "...", new_locale: "..." }` entries to `dict`.
3. In server components: `import { t } from "@/lib/i18n/server"; t("key.path")`.
4. In client components: do server-component wrapper that resolves strings and passes them as props. See `app/(auth)/login/page.tsx` for the pattern.
5. Run `npm run test` — the dict-coverage test ensures every key has translations for every shipped locale.

### Why not next-intl
- We translate ~30 strings, not 30,000. Library overhead would dwarf the dictionary.
- No ICU message-format needs yet (no plurals/dates/gender placeholders).
- Cookie-driven locale → no URL routing rewrite or middleware change.

When we hit ~200 strings or need ICU features, swap `lib/i18n/*` for next-intl. The `t()` API is intentionally similar so the swap is mostly mechanical.

## Operations &amp; production posture

### Backups &amp; restore

We rely on **Supabase native backups**. Free tier = 7 days of daily Point-in-Time-Recovery. Pro tier = 14 days + custom restore points.

**To restore:**
1. Supabase Dashboard → Database → Backups
2. Pick a point-in-time, click Restore (clones into a new project)
3. Update `DATABASE_URL` / `DIRECT_URL` in your Vercel env vars to point at the new project
4. Run `npx prisma db push` to ensure schema matches if any drift

For point-in-time backups at &lt;daily granularity, upgrade Supabase to Team tier (custom WAL retention). We don't ship our own backup UI — duplicating Supabase's offering is wasted engineering. Document the recovery procedure with your team; rehearse twice a year.

### Single region

Database is in `ap-northeast-1` (Tokyo). Latency from India ≈ 80-150 ms, from US/EU significantly worse. For multi-region:
- Supabase has read replicas on Team tier — wire a separate `READ_REPLICA_URL` and route read-heavy queries (analytics, audit log, designs list) there.
- Vercel functions are global — co-locate by setting `runtime` per route or by moving heavy reads to edge functions.

### CDN for AI render images

Replicate URLs expire after ~1 hour. The on-screen design viewer fetches them every page load — slow + relies on Replicate being up. **Fix path (not implemented):**
1. On render success, `fetch` the image
2. Upload to Supabase Storage in a public `renders/` bucket (file naming: `${designId}.webp`)
3. Persist the new URL in `BuildingDesign.renderImageUrl`
4. PDF export already fetches at generation time — no change needed there

Skipped for now because Replicate's URLs are stable enough for our launch volume. Revisit when load &gt; 50 renders/day.

### PDF generation is synchronous

A 4-floor PDF takes 800 ms – 1.2 s. At &gt;10 concurrent requests Next.js serverless functions queue. For a launch SaaS this is fine. When it isn't:
- Move PDF generation to a background job queue (Inngest / Trigger.dev / a simple Postgres queue)
- Return a job-id immediately, poll or push completion
- Email the PDF link when ready

### Design-cache invalidation knob

`lib/architect/design-cache.ts` has a `RULES_VERSION` constant. Bump it whenever the rules engine, room library, cost multipliers, or any logic feeding cached output changes. All entries hashed under the old version become unreachable and the next request regenerates fresh.

### A/B variant assignment is "sticky deterministic" — by design

`pickSubjectVariant(designId)` is intentionally a pure hash → variant. Same lead always sees the same subject. This is correct because:
- Experiments need stable assignment to attribute conversions
- Re-bucketing mid-experiment poisons the data

If a variant is clearly bad: add a new variant (and remove the bad one from `SUBJECT_VARIANTS`). Existing leads that hashed to the removed variant will be re-bucketed on their next email — acceptable since they didn't convert anyway.

### Send-time optimization uses a global histogram, not per-recipient

Per-recipient send-time prediction needs a stable identity for each lead, which we don't have until they're claimed. Once claimed, they get a User row and `User.bestSendHourUtc` updates from email-click signals. **Future work:** when we have ≥ 1000 claimed leads, swap the global histogram for a Bayesian per-recipient estimator.

### Team / multi-tenant billing aggregation

A brokerage chain with 5 orgs today = 5 separate Razorpay subscriptions, no master invoice. Implementing aggregated billing requires:
- A `BillingAccount` model that owns multiple `Organization` rows
- Razorpay's "Customer" entity wired as the BillingAccount, with `Subscription` per org
- A consolidated dashboard view that sums usage/cost across owned orgs

Defer until a chain customer asks. Until then, a chain can manage 5 independent subscriptions manually.

### Accessibility posture

We have **not** done a full WCAG audit. Quick spot-checks:
- ✓ Forms have `&lt;label&gt;` elements tied to inputs (everywhere)
- ✓ Buttons have visible text (no icon-only without `aria-label`)
- ✓ Color contrast is acceptable on Tailwind brand teal against white
- ⚠ The 3D viewer is keyboard-inaccessible (Three.js canvas) — provide the 2D plans as the accessible equivalent
- ⚠ The wizard `TkxStepper` has no `aria-current="step"` (depends on tekivex-ui internals)
- ⚠ No skip-to-content link on the dashboard layout
- ⚠ No `lang` attribute switching when locale changes (only static `lang="en"`)

For a production audit: hire a WCAG-AA contractor, fix the items they find. Before that, the app is at "internal use OK, public-launch a11y review pending" status — same as most early SaaS.

## Architecture decisions (do not relitigate)

### DWG export — stubbed, not implemented

We ship **DXF**, not native `.dwg`. The `/api/architect/export/[id]/dwg` route exists and the UI button is visible-but-disabled with an `enterprise` badge. Server returns **HTTP 501** with a JSON payload pointing the caller at the DXF endpoint. `lib/architect/export-dwg.ts` exposes a `setDwgEncoder(enc)` plug-point — when a real encoder lands, the existing API/UI activate automatically.

Why we don't implement it today (re-evaluated 2026):

| Path | Verdict |
|---|---|
| Wrap `@mlightcad/libredwg-web` | **GPL-3.0**, plus that package reads DWG, doesn't write it. Useless for our case. |
| Compile LibreDWG (C) to WASM with Emscripten | 2-4 weeks of Emscripten plumbing + **permanent GPL contamination risk** under FSF's interpretation of WASM as linking. |
| Shell out to `oda_file_converter` binary | Works, but kills our Vercel serverless deploy story — needs a dedicated container with the ODA binary preinstalled. |
| Write our own DWG R12 encoder in TypeScript | ~3 months full-time. Output: AutoCAD opens with format-upgrade prompt. Maintenance treadmill on every AutoCAD release. |
| License **ODA Teigha** SDK | $2-5K/yr. Canonical writer. **This is the correct path** once ≥5 paying customers explicitly require DWG. |

Until that signal materializes: every CAD tool architects actually use (AutoCAD, LibreCAD, QCAD, DraftSight, FreeCAD, BricsCAD) imports DXF cleanly. No client is currently blocked.

To revisit, search for `DWG_NOT_IMPLEMENTED` in the codebase.

### Why not native `.dwg` from npm packages

- `@mlightcad/libredwg-web` — GPL-3.0, reader only
- `libredwg-web` — does not exist
- `@x-viewer/core` — viewer only, no write
- No production-ready DWG *writer* exists on npm at any license as of this codebase.

## Deploy

- Vercel for Next.js (zero-config; crons in `vercel.json` activate automatically on production deploys)
- Supabase for DB + auth + storage
- Set every env var from `.env.example` in Vercel project settings
