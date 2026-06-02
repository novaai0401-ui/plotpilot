import { prisma } from "@/lib/db/prisma";
import { hashPassword, verifyPassword, needsRehash } from "./password";
import { mintToken, hashTokenSha256 } from "./tokens";
import { verifyTotp } from "./totp";
import { createSession } from "./session-cookie";
import { sendEmail } from "@/lib/email/resend";
import { provisionUser, type ProvisionInput } from "../provision";

/**
 * Native authentication service.
 *
 * Owns the orchestration of: signup → User+credential+verification email,
 * login → password+optional MFA check → session mint, MFA challenge
 * second step, and email verification.
 *
 * Brute-force defense: per-credential `failedLoginCount` + 15-minute lockout
 * after 8 failed attempts. Per-IP rate limit is layered on top via
 * `lib/rate-limit.ts` at the route handler layer.
 */

const FAILED_LOGIN_THRESHOLD = 8;
const LOCKOUT_MINUTES = 15;
const VERIFY_TTL_MS = 24 * 60 * 60 * 1000;

// ─── Signup ───────────────────────────────────────────────────────────────────

export type SignupInput = {
  email: string;
  password: string;
  name: string;
  phone: string;
  orgName?: string;
  inviteToken?: string;
  teamToken?: string;
  ip?: string;
  userAgent?: string;
};

export type SignupResult =
  | { ok: true; userId: string; orgId: string; role: string; emailVerificationToken: string }
  | { ok: false; error: string; status: number };

export async function signup(input: SignupInput): Promise<SignupResult> {
  const email = input.email.trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, error: "Valid email required.", status: 400 };
  }
  if (!input.password || input.password.length < 8) {
    return { ok: false, error: "Password must be at least 8 characters.", status: 400 };
  }
  // Reject obvious duplicates early. We still race-guard via the unique constraint below.
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return { ok: false, error: "An account with that email already exists.", status: 409 };
  }

  const passwordHash = await hashPassword(input.password);

  // Use a synthetic authId since we no longer talk to Supabase. The column
  // is kept (and indexed) so we don't need a schema migration in this round;
  // we just generate our own values now.
  const authId = `native_${cryptoRandomId()}`;

  const provisionInput: ProvisionInput = {
    authId,
    authEmail: email,
    orgName: input.orgName,
    name: input.name,
    phone: input.phone,
    email,
    inviteToken: input.inviteToken,
    teamToken: input.teamToken,
  };
  const provisioned = await provisionUser(provisionInput);
  if (!provisioned.ok) return { ok: false, error: provisioned.error, status: provisioned.status };

  // Credential + email-verification token in one transaction so a crash mid-way
  // can't leave a user without a credential row.
  const verifyToken = mintToken("pbev_", 32);
  await prisma.$transaction([
    prisma.authCredential.create({
      data: { userId: provisioned.userId, passwordHash },
    }),
    prisma.emailVerification.create({
      data: {
        userId: provisioned.userId,
        tokenHash: verifyToken.tokenHash,
        email,
        expiresAt: new Date(Date.now() + VERIFY_TTL_MS),
      },
    }),
  ]);

  // Fire-and-forget: a slow / failing email send must not break signup.
  void sendVerificationEmail(email, input.name, verifyToken.rawToken);

  // Mint a session — user is logged in immediately. They get the
  // "verify your email" banner in dashboard until they click the link.
  await createSession({
    userId: provisioned.userId,
    mfaVerified: false,
    ip: input.ip,
    userAgent: input.userAgent,
  });

  return {
    ok: true,
    userId: provisioned.userId,
    orgId: provisioned.orgId,
    role: provisioned.role,
    emailVerificationToken: verifyToken.rawToken,
  };
}

// ─── Login ────────────────────────────────────────────────────────────────────

export type LoginInput = {
  email: string;
  password: string;
  ip?: string;
  userAgent?: string;
};

export type LoginResult =
  | { ok: true; userId: string; mfaRequired: false }
  | { ok: true; userId: string; mfaRequired: true; pendingMfaToken: string }
  | { ok: false; error: string; status: number };

/**
 * MFA-pending challenge state. The user has cleared password but not the
 * second factor. We mint a short-lived token (10 min, sha256-hashed in a
 * Session row with mfaVerified=false AND no active status — we use a
 * dedicated session-like row) that the MFA-completion endpoint consumes.
 *
 * For simplicity we use the Session table itself with a 10-minute expiry,
 * marked mfaVerified=false. The /api/auth/login/mfa endpoint validates the
 * pending session AND the MFA code, then upgrades the session to a full
 * 7-day one.
 */
const MFA_CHALLENGE_TTL_MS = 10 * 60 * 1000;

export async function login(input: LoginInput): Promise<LoginResult> {
  const email = input.email.trim().toLowerCase();
  const user = await prisma.user.findUnique({
    where: { email },
    include: { credential: true },
  });
  if (!user || !user.credential) {
    // Same error for unknown email + wrong password — don't leak account existence.
    return { ok: false, error: "Email or password is incorrect.", status: 401 };
  }

  const cred = user.credential;
  if (cred.lockedUntil && cred.lockedUntil > new Date()) {
    const mins = Math.ceil((cred.lockedUntil.getTime() - Date.now()) / 60_000);
    return {
      ok: false,
      error: `Account locked due to too many failed attempts. Try again in ~${mins} minute(s).`,
      status: 429,
    };
  }

  const passwordOk = await verifyPassword(input.password, cred.passwordHash);
  if (!passwordOk) {
    const nextCount = cred.failedLoginCount + 1;
    const updates: any = { failedLoginCount: nextCount };
    if (nextCount >= FAILED_LOGIN_THRESHOLD) {
      updates.lockedUntil = new Date(Date.now() + LOCKOUT_MINUTES * 60_000);
      updates.failedLoginCount = 0;
    }
    await prisma.authCredential.update({ where: { id: cred.id }, data: updates });
    return { ok: false, error: "Email or password is incorrect.", status: 401 };
  }

  // Success path — reset counters. Re-hash with current params if needed.
  const credUpdates: any = { failedLoginCount: 0, lockedUntil: null };
  if (needsRehash(cred.passwordHash)) {
    credUpdates.passwordHash = await hashPassword(input.password);
  }
  await prisma.authCredential.update({ where: { id: cred.id }, data: credUpdates });

  // If MFA is enrolled, mint a pending-challenge session instead of a full one.
  if (cred.mfaSecret && cred.mfaEnrolledAt) {
    const pending = mintToken("pbmfa_", 32);
    await prisma.session.create({
      data: {
        userId: user.id,
        tokenHash: pending.tokenHash,
        ip: input.ip || null,
        userAgent: input.userAgent || null,
        mfaVerified: false,
        // Mark expired-soon so an unconsumed challenge can't function as a session.
        expiresAt: new Date(Date.now() + MFA_CHALLENGE_TTL_MS),
        status: "active",
      },
    });
    return { ok: true, userId: user.id, mfaRequired: true, pendingMfaToken: pending.rawToken };
  }

  // No MFA — mint a full session straight away.
  await createSession({
    userId: user.id,
    mfaVerified: false,
    ip: input.ip,
    userAgent: input.userAgent,
  });
  return { ok: true, userId: user.id, mfaRequired: false };
}

// ─── MFA challenge completion ─────────────────────────────────────────────────

export type CompleteMfaInput = {
  pendingMfaToken: string;
  code: string; // 6-digit TOTP OR recovery code
  ip?: string;
  userAgent?: string;
};

export type CompleteMfaResult =
  | { ok: true; userId: string }
  | { ok: false; error: string; status: number };

export async function completeMfaChallenge(input: CompleteMfaInput): Promise<CompleteMfaResult> {
  const tokenHash = hashTokenSha256(input.pendingMfaToken);
  const pending = await prisma.session.findUnique({
    where: { tokenHash },
    include: { user: { include: { credential: true } } },
  });
  if (!pending || pending.status !== "active" || pending.expiresAt < new Date()) {
    return { ok: false, error: "Login challenge expired. Sign in again.", status: 400 };
  }
  const cred = pending.user.credential;
  if (!cred || !cred.mfaSecret) {
    return { ok: false, error: "MFA is not enrolled for this account.", status: 400 };
  }

  const code = input.code.trim();
  // Try TOTP first.
  let accepted = verifyTotp(cred.mfaSecret, code);

  // Then recovery codes (sha256-stored).
  let updatedRecovery: string[] | null = null;
  if (!accepted) {
    const candidateHash = hashTokenSha256(code.toLowerCase());
    const altHash = hashTokenSha256(code.toUpperCase());
    const matchIdx = cred.mfaRecoveryHashes.findIndex((h) => h === candidateHash || h === altHash);
    if (matchIdx >= 0) {
      accepted = true;
      // Single-use: drop the matching hash.
      updatedRecovery = [
        ...cred.mfaRecoveryHashes.slice(0, matchIdx),
        ...cred.mfaRecoveryHashes.slice(matchIdx + 1),
      ];
    }
  }

  if (!accepted) {
    return { ok: false, error: "Code is invalid or expired.", status: 401 };
  }

  // Consume the pending challenge and mint a full session.
  await prisma.$transaction([
    prisma.session.update({
      where: { id: pending.id },
      data: { status: "revoked", revokedAt: new Date() },
    }),
    ...(updatedRecovery
      ? [prisma.authCredential.update({ where: { id: cred.id }, data: { mfaRecoveryHashes: updatedRecovery } })]
      : []),
  ]);
  await createSession({
    userId: pending.userId,
    mfaVerified: true,
    ip: input.ip,
    userAgent: input.userAgent,
  });

  return { ok: true, userId: pending.userId };
}

// ─── Email verification ──────────────────────────────────────────────────────

export async function verifyEmail(rawToken: string): Promise<{ ok: true; userId: string } | { ok: false; error: string }> {
  const tokenHash = hashTokenSha256(rawToken);
  const row = await prisma.emailVerification.findUnique({ where: { tokenHash } });
  if (!row) return { ok: false, error: "Invalid or already-used verification link." };
  if (row.usedAt) return { ok: false, error: "This verification link was already used." };
  if (row.expiresAt < new Date()) return { ok: false, error: "Verification link expired." };
  await prisma.$transaction([
    prisma.emailVerification.update({ where: { id: row.id }, data: { usedAt: new Date() } }),
    prisma.authCredential.updateMany({
      where: { userId: row.userId },
      data: { emailVerifiedAt: new Date() },
    }),
  ]);
  return { ok: true, userId: row.userId };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function sendVerificationEmail(toEmail: string, toName: string, rawToken: string): Promise<void> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const link = `${appUrl}/auth/verify-email?token=${encodeURIComponent(rawToken)}`;
  const safeName = toName.split(" ")[0] || "there";

  await sendEmail({
    to: toEmail,
    subject: "Verify your PlotBroker email",
    text:
      `Hi ${safeName},\n\n` +
      `Confirm your email to finish setting up your PlotBroker account: ${link}\n\n` +
      `The link expires in 24 hours. If you didn't sign up, ignore this email.`,
    html:
      `<p>Hi ${escapeHtml(safeName)},</p>` +
      `<p>Confirm your email to finish setting up your PlotBroker account:</p>` +
      `<p><a href="${escapeAttr(link)}">Verify email →</a></p>` +
      `<p style="color:#666;font-size:12px">The link expires in 24 hours. If you didn't sign up, ignore this email.</p>`,
  }).catch(() => {
    // Email failure must not break signup. Logged inside sendEmail when configured.
  });
}

function cryptoRandomId(): string {
  // Cheap unique id — used only as the synthetic authId placeholder.
  return Array.from({ length: 12 }, () => Math.floor(Math.random() * 16).toString(16)).join("");
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}
function escapeAttr(s: string): string {
  return escapeHtml(s);
}
