# Email deliverability — operator setup

The app sends transactional email through [Resend](https://resend.com).
Resend gives you the API; deliverability (landing in the inbox, not spam)
is your DNS team's job. This document is the checklist.

If your operator hasn't done this, every cold-start email — signup
confirmation, lead follow-up, team invite — lands in spam. The fix is
~15 minutes of DNS work.

---

## 1. Prerequisites

- A domain you control (e.g. `yourbrokerage.com`)
- Access to that domain's DNS provider (Cloudflare, Route 53, GoDaddy, …)
- A Resend account (free tier is fine for setup; bump to paid before live traffic)

## 2. Create the Resend domain

1. Resend dashboard → **Domains** → **Add Domain**
2. Enter the domain you'll send FROM (e.g. `yourbrokerage.com`).
   You can use a subdomain like `mail.yourbrokerage.com` to isolate
   reputation — recommended for mature deployments.
3. Resend shows ~5 DNS records to add. Don't close that tab.

## 3. Add DNS records

Each entry below is what Resend will ask you for. The **exact values
vary per account** — copy them from Resend, not from this doc.

### SPF (one TXT record)

```
Type:  TXT
Name:  @                    (or `mail` if you used a subdomain)
Value: v=spf1 include:amazonses.com ~all
```

What it does: tells receiving mail servers that Amazon SES (Resend's
upstream) is authorized to send for your domain.

> If you already have an SPF record (e.g. from Google Workspace), MERGE
> them — you can only have one SPF record per domain. Example merge:
> `v=spf1 include:_spf.google.com include:amazonses.com ~all`

### DKIM (three CNAME records — Resend provides them)

```
Type:  CNAME
Name:  resend._domainkey
Value: <unique-per-account>.dkim.amazonses.com

Type:  CNAME
Name:  <selector-2>._domainkey
Value: <unique-per-account>.dkim.amazonses.com

Type:  CNAME
Name:  <selector-3>._domainkey
Value: <unique-per-account>.dkim.amazonses.com
```

What it does: cryptographically signs every outbound message so receivers
can verify it really came from your domain.

### DMARC (one TXT record)

```
Type:  TXT
Name:  _dmarc
Value: v=DMARC1; p=none; rua=mailto:dmarc-reports@yourbrokerage.com
```

What it does: tells receivers what to do with mail that fails SPF/DKIM,
and where to send aggregate reports.

**Start with `p=none`** to monitor without blocking. After 1-2 weeks of
clean reports, ratchet to `p=quarantine`, then `p=reject`. Going
straight to `p=reject` can silently drop legitimate mail if you missed
a sender (newsletters, Calendly, etc.).

### Return-Path (MX, optional but recommended)

If Resend offers a custom return-path (bounce-handling subdomain), add it.
This improves bounce processing and reputation.

## 4. Verify in Resend

Back in the Resend dashboard → Domains → click **Verify**.

- SPF/DKIM/DMARC should each go green within a few minutes
- If not, DNS propagation can take up to 24h; usually it's <15 min
- Common gotcha: your DNS provider auto-appends the domain to the `Name`
  field. If Resend says `Name: resend._domainkey` and your provider's
  field already says "yourbrokerage.com", just enter `resend._domainkey`
  — not `resend._domainkey.yourbrokerage.com`.

## 5. Configure the app

```bash
# .env (or wherever you keep prod env vars)
RESEND_API_KEY="re_••••••"
RESEND_FROM_EMAIL="PlotBroker <hello@yourbrokerage.com>"
```

The `From:` address must use the domain you just verified. If you use
the wrong domain, every send returns 422 from Resend.

## 6. Validate from the command line

```bash
# Sanity check: is the domain marked verified?
curl -s -H "Authorization: Bearer $RESEND_API_KEY" \
  https://api.resend.com/domains | jq '.data[] | { name, status }'

# Send a test email
curl -s -X POST -H "Authorization: Bearer $RESEND_API_KEY" \
  -H "content-type: application/json" \
  https://api.resend.com/emails \
  -d '{
    "from": "hello@yourbrokerage.com",
    "to": "you@gmail.com",
    "subject": "PlotBroker deliverability check",
    "text": "If you got this in the inbox, SPF/DKIM/DMARC are wired up."
  }' | jq .
```

The returned `id` lets you fetch delivery status:

```bash
curl -s -H "Authorization: Bearer $RESEND_API_KEY" \
  "https://api.resend.com/emails/<id>" | jq .last_event
```

## 7. Inbox-placement check across major providers

A green Resend dashboard is necessary but not sufficient. Major providers
score differently:

| Provider | What to test | Pass criteria |
|---|---|---|
| **Gmail** | Send to a fresh Gmail account; check inbox (not promotions, not spam) | Lands in Primary tab |
| **Outlook / Hotmail** | Send to an outlook.com account | Inbox, not junk |
| **Apple Mail (iCloud)** | Send to an @icloud.com account | Inbox |
| **Yahoo Mail** | Send to a fresh Yahoo account | Inbox |

If any of these fail:

1. Send from `[mail.google.com](https://toolbox.googleapps.com/apps/checkmx/check)`
   to verify your domain shows green on all three pillars (SPF/DKIM/DMARC).
2. Check [mail-tester.com](https://www.mail-tester.com/) — paste the
   address there, send a real PlotBroker email, click "check score."
   Aim for **9/10 or higher**. Lower scores get triaged to spam.
3. Most common 8/10 fail: missing `List-Unsubscribe` header. The Resend
   SDK adds it automatically if your message includes plain text alongside
   HTML — make sure `lib/email/resend.ts` is always passing both `html`
   and `text`.

## 8. Reputation maintenance

After launch:

- Watch the DMARC aggregate reports (the `rua` address from step 3).
  [Postmark's DMARC reporting](https://dmarc.postmarkapp.com/) is a free
  visualizer.
- Don't send to non-existent addresses — every bounce hurts reputation.
  Validate emails at signup; we already do (`/^[^\s@]+@[^\s@]+\.[^\s@]+$/`)
  but consider Resend's [email validation API](https://resend.com/docs/api-reference/emails/validate-an-email)
  for high-value sends.
- Don't send marketing from this domain. Transactional and marketing should
  use **different subdomains** (e.g. `mail.yourbrokerage.com` vs
  `news.yourbrokerage.com`) to isolate reputation.
- If you ever get rate-limited or marked as spam by a major provider,
  Resend support can request reputation review.

## 9. Common pitfalls

| Symptom | Cause | Fix |
|---|---|---|
| All mail to Gmail goes to spam | DKIM not propagated | Wait 24h; re-verify in Resend |
| All mail to Outlook bounces | SPF includes wrong IP range | Use exactly what Resend gives you, don't hand-edit |
| Some mail delivered, some not | `p=quarantine` too aggressive too soon | Revert to `p=none`, watch reports for a week |
| 422 from Resend API | `From:` domain not verified | Match the verified domain exactly |
| Mail shows "via amazonses.com" in Gmail | DKIM not aligned | Add the three DKIM CNAMEs from step 3 |

## 10. Disabling email entirely

If you don't want to send any email (dev / pre-launch), leave
`RESEND_API_KEY` unset. `lib/email/resend.ts` logs a warning and returns
ok-but-not-sent — the app still works, signup just doesn't deliver
confirmations. Useful for local dev where Supabase has email confirmation
disabled.
