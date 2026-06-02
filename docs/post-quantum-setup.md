# Post-quantum setup (team-invite tokens)

Team invitations carry a signed token in the URL. We support **two backends**:

| Backend | Signature | Token size | When used |
|---|---|---:|---|
| ML-DSA-87 (Dilithium-5) | post-quantum | ~6.7 KB hex | When all three `TEAM_INVITE_*` env vars are set |
| HMAC-SHA256 | classical | ~300 B | Fallback when any TEAM_INVITE_* var is missing |

HMAC is secure today against classical attackers — but post-quantum
attackers (Shor's algorithm against classical signatures + Grover's against
hash MACs) can break it in finite time. ML-DSA-87 is the NIST FIPS 204 PQ
standard and is what NIST recommends for high-value signatures.

**Production deploys should run on ML-DSA.** The fallback exists for local
dev + CI where the key-management ceremony isn't worth it.

## Setup (one-time)

```bash
npm run gen:invite-keys
```

Output:

```
TEAM_INVITE_SIGNING_KEY="..."
TEAM_INVITE_VERIFYING_KEY="..."
TEAM_INVITE_ENCRYPT_KEY="..."
TEAM_INVITE_CHAIN_SEED="..."
```

Paste those four lines into your `.env` (or your deploy's secret store
— Vercel project env, Fly secrets, etc.).

## Multi-instance deploys

The keys must be **the same across every instance**. With the persisted-keys
release that's automatic — every instance reads the same `KeyMaterial` row.

If you instead use the env-var override path, the same rule applies but
you provide it:

- Vercel: project settings → environment variables → set once per
  environment (Production, Preview, Development).
- Fly: `flyctl secrets set TEAM_INVITE_SIGNING_KEY=… TEAM_INVITE_VERIFYING_KEY=… …`
- Docker/k8s: pull from your secret manager at container start; do NOT
  generate at boot per instance.

## Rotation

To rotate the keypair:

1. Invalidate active invitations:
   ```sql
   UPDATE "Invitation" SET status = 'revoked' WHERE status = 'pending';
   ```
   (Or accept that any in-flight team invites will need re-issuing.)
2. Run `npm run gen:invite-keys` and replace the values in your secret store.
3. Redeploy.

A future rotation-friendly setup would store BOTH the current and previous
verifying keys, accepting either during a grace window. Not implemented
yet — file an issue if you need it.

## Verifying the right backend is active

Issue a test invite, decode the token by hand:

- Format `<base64url>.<base64url>` (two dot-separated segments) → HMAC
- Format `<pure-hex-string>` (no dot) → ML-DSA

Or check the production logs at boot: when ML-DSA keys are missing in a
production deploy, the server emits a structured warning:

```json
{ "level": "warn", "subsystem": "team-invite-token",
  "message": "ML-DSA keys not configured — falling back to HMAC-SHA256...",
  "action": "configure_team_invite_keys" }
```

## Default-on path (no operator setup required)

As of the persisted-keys release, ML-DSA is **default-on with zero operator
setup** — env vars stay as an opt-in override.

How it works:

1. First request hits `lib/auth/team-invite-token.ts` → no env vars set
2. Loader queries `KeyMaterial` table for `kind="team_invite"`, `version=1`
3. Row missing → loader calls `generateKeypair()` from `@sigvault/sdk` and
   INSERTs the row (caught race condition: simultaneous boots converge
   on the same row via the `(kind, version)` unique constraint)
4. All future cold boots, on this instance and every other, read the same
   persisted keys
5. Tokens issued by instance A verify on instance B

You only need to set the `TEAM_INVITE_*` env vars when:

- **Rotation** — you want to bump to version=2 by hand
- **Split deploys** — multiple deploys must share a keypair but DON'T share
  a database (rare; e.g. an edge deploy that issues tokens for a
  separate origin to verify)
- **Air-gapped audit** — you want the operator to provide keys from a hardware
  HSM rather than auto-generate them in-process

The audit trail is preserved either way: the loader emits a one-time stderr
log on successful provisioning (`subsystem=team-invite-token, message=Provisioned ML-DSA keypair`)
which is captured by Sentry.

## Rotation
