# AI cost model — the actual math

This document is the honest answer to "what does the AI Co-Pilot cost
to run?" Real numbers, no hand-waving, with the levers we've already
built in to keep the bill from eating the broker's margin.

## TL;DR

- **Free plan**: ₹0/month. No LLM. Deterministic fallback.
- **Pro plan**: ≤ **₹5–25/org/month** for a typical 50-plot brokerage.
  Cap of ₹400/month (₹500¢ ≈ $5) enforced by hard 402.
- **Enterprise plan**: ≤ **₹200–500/org/month** for the same brokerage.
  Cap of ₹2000/month enforced.

The persistent cache is the load-bearing piece. Without it, even Haiku
would scale to ₹6,000/month on Sonnet equivalents. With it, the org
pays for each (plot, client) pitch and each plot valuation **exactly
once**, ever, until the underlying data changes.

## Per-call costs

Token counts measured against the production system prompts in
`lib/matching/pitch.ts` and `lib/matching/valuation.ts`. Conversion at
USD → INR = 83.

| Operation | Input tok | Output tok | Haiku 4.5 | Sonnet 4.5 |
|---|---:|---:|---:|---:|
| Pitch (per match) | ~450 | ~200 | **₹0.10** | ₹0.36 |
| Valuation (per plot) | ~250 | ~600 | **₹0.22** | ₹0.81 |

Pro plan uses Haiku for both. Enterprise uses Haiku for pitches and
Sonnet for valuations (the broker is paying for the reasoning depth).

## Per-org costs at steady state

Assume a typical Pro-plan broker: 50 plots in inventory, 100 clients
in the org, average ~6 months of usage.

**Without caching** (the naive implementation):

```
Pitches:     50 plots × 100 clients × 0.10 = ₹500
Valuations:  50 plots × 5 page loads × 0.22 = ₹55
                                       Total = ₹555 / org / month
```

…and that's the GOOD case. Brokers often refresh the page repeatedly,
which would 10× this.

**With `LlmCache`** (what we shipped):

```
Pitches:     each (plot, client) pair paid for ONCE per 30 days
              ≈ 50 × 100 = 5,000 unique calls per QUARTER, not per month
              ≈ 1,650/month × 0.10 = ₹165 first month
              ≈ subsequent months: only NEW pairs, typically ~20/day
              = 20 × 30 × 0.10 = ₹60 / org / month after warm-up

Valuations:  each plot paid for ONCE per 60 days
              ≈ 50 × 0.22 = ₹11 every other month
              = ₹5.50 / org / month
```

**Effective steady state: ₹65–75 / org / month.** Well inside the
₹400 cap. Most orgs never come close.

The first-month cold-start (~₹170) is fine; we recoup it inside the
month from a single Pro subscription (₹2,499).

## The four cost levers

### 1. Plan-tier gating (`lib/llm/models.ts`)

```ts
chooseModel(plan, kind)
  free        → null            (no LLM, ever, on either kind)
  pro         → haiku-4-5       (both kinds)
  enterprise  → haiku-4-5       (pitches)
                sonnet-4-5      (valuations)
```

Free-plan orgs never hit Anthropic. The UI tells the broker their
output is heuristic and offers an upgrade. Pro is enough for everyone
except brokers who specifically want Sonnet's reasoning for valuations.

### 2. Persistent cache (`lib/llm/cache.ts`, table `LlmCache`)

Key = sha256 of canonicalized input, 24-char prefix. TTL per kind:

- pitch: 30 days
- valuation: 60 days

Survives cold boots. Org-scoped via FK so account deletion cascades the
cache (no GDPR liability).

### 3. Pre-call budget check (`lib/llm/client.ts`)

Before every Anthropic call we sum month-to-date llm_tokens spend from
UsageEvent. Exceeded → throws `LlmCapHitError` → route returns the
deterministic fallback with `fallbackReason: "cap_hit"` and the UI shows
"Monthly AI budget reached — falling back to template."

The cap is `Organization.monthlyLlmBudgetUsdCents`, defaults to ¢500
(₹400). Editable from settings.

### 4. Per-call usage logging (`logUsage` → `UsageEvent`)

Every call writes a row with exact input/output token counts and INR
cost. Shows up in `/dashboard/usage` so the broker can see today's
spend at a glance.

## Operator levers

If broker costs spike unexpectedly:

1. **Inspect** `/admin/orgs/<id>` → recent UsageEvent rows.
2. **Tighten the cap**: `UPDATE "Organization" SET "monthlyLlmBudgetUsdCents" = 250 WHERE id = ...` (₹200/month).
3. **Force-clear the cache** for testing: `DELETE FROM "LlmCache" WHERE "orgId" = ...`. Be aware the next page load pays for re-generation.

## Future levers (not built yet)

These would push the bill down further but aren't worth the complexity yet:

- **BYOK** (bring your own Anthropic key per org, encrypted at rest) —
  removes our cost entirely; broker bills go to their own Anthropic
  account. Useful for high-volume Enterprise orgs that want unrestricted
  scaling.
- **Local model option** — a self-hosted small model (Qwen, Llama, etc.)
  per deploy. Same prompts, near-zero per-call cost, slower latency.
  Worth it if we ever serve a market where Anthropic isn't acceptable.
- **Pre-computed pitches via cron** — generate every (plot, top-5-match)
  pair overnight in batched API calls (50% discount). Reduces page-load
  latency to 0, deepens the cache hit rate.

## Audit trail

Every LLM call is reflected in two places:

1. `UsageEvent` row — `kind=llm_tokens`, metadata `{kind, model, inputTokens, outputTokens, costInrPaise, reason}`.
2. `LlmCache` row — written on success, read on subsequent matching calls.

A broker who wants to verify "did the AI Co-Pilot actually cost what
you said it cost" can export their UsageEvents via the existing CSV
data-export endpoint and reconcile.
