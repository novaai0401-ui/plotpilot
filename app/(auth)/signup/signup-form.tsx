"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
// Native auth — no third-party identity dependency. Calls /api/auth/native/signup
// which provisions the org + user + credential row in one transaction and sets
// the session cookie. The user gets a "verify your email" banner inside the
// dashboard; verification is via the link sent during signup.
import {
  TkxAlert,
  TkxButton,
  TkxCard,
  TkxCardBody,
  TkxCardHeader,
  TkxInput,
} from "@/components/tkx-dyn";

type TeamPreview =
  | {
      kind: "team";
      status: "valid";
      orgName: string;
      role: "broker_admin" | "broker_agent";
      email: string;
      name?: string;
    }
  | { kind: "team"; status: "invalid"; reason: string }
  | { kind: "team"; status: "expired" };

type ClientPreview =
  | { kind: "client"; status: "valid"; orgName: string; expiresAt: Date }
  | { kind: "client"; status: "invalid"; reason: string }
  | { kind: "client"; status: "expired" };

type InvitePreview = TeamPreview | ClientPreview | null;

export function SignupForm({ preview }: { preview: InvitePreview }) {
  const router = useRouter();
  const params = useSearchParams();
  const inviteToken = params.get("invite");
  const teamToken = params.get("team");

  if (preview && preview.status !== "valid") {
    return <InviteErrorScreen preview={preview} />;
  }

  const verifiedTeam = preview?.kind === "team" && preview.status === "valid" ? preview : null;
  const verifiedClient = preview?.kind === "client" && preview.status === "valid" ? preview : null;

  const [orgName, setOrgName] = useState("");
  const [name, setName] = useState(verifiedTeam?.name || "");
  const [phone, setPhone] = useState("");
  // For team invites, email is locked to what the inviter typed — changing it would
  // make the token reject during provision (email-match check in provisionUser).
  const [email, setEmail] = useState(verifiedTeam?.email || "");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const nextPath = teamToken ? "/dashboard" : inviteToken ? "/portal" : "/dashboard";

    try {
      const csrf =
        typeof document !== "undefined"
          ? document.cookie.match(/(^|; )csrf_token=([^;]+)/)?.[2]
          : undefined;
      const res = await fetch("/api/auth/native/signup", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(csrf ? { "x-csrf-token": decodeURIComponent(csrf) } : {}),
        },
        body: JSON.stringify({
          email,
          password,
          name,
          phone,
          orgName: orgName || undefined,
          inviteToken: inviteToken || undefined,
          teamToken: teamToken || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);

      // Session cookie is already set. Show "check your inbox" briefly so
      // the user knows the verification email is coming, then forward.
      setPendingEmail(email);
      setTimeout(() => {
        router.push(nextPath);
        router.refresh();
      }, 1500);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  if (pendingEmail) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-gray-50 px-4 py-12">
        <div className="w-full max-w-md">
          <TkxCard variant="elevated" padding="lg">
            <TkxCardHeader
              title="📬 Check your inbox"
              subtitle="One last step to activate your account."
            />
            <TkxCardBody>
              <div className="space-y-4">
                <TkxAlert variant="info" title="Confirmation email sent">
                  We sent a confirmation link to <strong>{pendingEmail}</strong>. Click it to
                  activate your account — you&apos;ll be signed in and dropped straight into{" "}
                  {inviteToken ? "your client portal" : "your dashboard"}.
                </TkxAlert>
                <p className="text-xs text-gray-500">
                  <strong>Didn&apos;t get it?</strong> Check spam, or have your Supabase admin
                  disable email confirmation in <em>Authentication → Sign In / Providers → Email</em>{" "}
                  for faster dev iteration.
                </p>
                <div className="flex justify-between text-xs">
                  <button
                    type="button"
                    onClick={() => setPendingEmail(null)}
                    className="text-gray-500 hover:underline"
                  >
                    ← Use a different email
                  </button>
                  <Link href="/login" className="text-brand font-medium hover:underline">
                    I already confirmed — sign in
                  </Link>
                </div>
              </div>
            </TkxCardBody>
          </TkxCard>
        </div>
      </main>
    );
  }

  const title = verifiedTeam
    ? `Join the ${verifiedTeam.role === "broker_admin" ? "admin" : "agent"} team`
    : verifiedClient
    ? "Join as client"
    : "Start your brokerage";
  const subtitle = verifiedTeam
    ? "Your colleague invited you. Set a password to activate your account."
    : verifiedClient
    ? "Your broker invited you. Create an account to see plots and visits."
    : "Create your organization in under a minute.";

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50 px-4 py-12">
      <div className="w-full max-w-md">
        <TkxCard variant="elevated" padding="lg">
          <TkxCardHeader title={title} subtitle={subtitle} />
          <TkxCardBody>
            <form
              onSubmit={onSubmit}
              className="space-y-4"
              noValidate
              aria-label={title}
            >
              {verifiedTeam && (
                <TkxAlert variant="success" title={`Joining ${verifiedTeam.orgName}`}>
                  Role:{" "}
                  <strong>
                    {verifiedTeam.role === "broker_admin" ? "Admin" : "Agent"}
                  </strong>{" "}
                  · Invite issued to <code>{verifiedTeam.email}</code>
                </TkxAlert>
              )}
              {verifiedClient && (
                <TkxAlert
                  variant="success"
                  title={`Joining ${verifiedClient.orgName} as a client`}
                >
                  Invite valid until{" "}
                  <strong>{verifiedClient.expiresAt.toLocaleDateString()}</strong>
                </TkxAlert>
              )}

              {/* aria-live wrapper for sign-up errors — see login-inner.tsx for rationale. */}
              <div aria-live="polite" aria-atomic="true">
                {error && (
                  <TkxAlert variant="danger" title="Sign-up failed">
                    {error}
                  </TkxAlert>
                )}
              </div>

              {!inviteToken && !teamToken && (
                <TkxInput
                  label="Brokerage name"
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                  placeholder="e.g. ABC Plots & Estates"
                  isRequired
                />
              )}

              <TkxInput
                label="Your name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                isRequired
                autoComplete="name"
              />

              <TkxInput
                label="Phone (with country code)"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+919876543210"
                isRequired
                autoComplete="tel"
              />

              <TkxInput
                label="Email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                isRequired
                readOnly={Boolean(verifiedTeam)}
                hint={
                  verifiedTeam
                    ? "Locked to the invited email — needed for the signed token to validate."
                    : undefined
                }
                autoComplete="email"
              />

              <TkxInput
                label="Password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                isRequired
                minLength={8}
                autoComplete="new-password"
              />

              <TkxButton
                type="submit"
                variant="solid"
                colorScheme="primary"
                isFullWidth
                isLoading={loading}
                loadingText="Creating account…"
                disabled={loading}
              >
                Create account
              </TkxButton>

              <div className="text-xs text-gray-500 text-center">
                Already have an account?{" "}
                <Link href="/login" className="text-brand font-medium">
                  Sign in
                </Link>
              </div>
            </form>
          </TkxCardBody>
        </TkxCard>
      </div>
    </main>
  );
}

function InviteErrorScreen({ preview }: { preview: TeamPreview | ClientPreview }) {
  const isTeam = preview.kind === "team";
  const expired = preview.status === "expired";
  const reason = preview.status === "invalid" ? preview.reason : null;
  const title = expired
    ? "This invite has expired"
    : isTeam
    ? "We couldn't verify this team invite"
    : "We couldn't verify this client invite";

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50 px-4 py-12">
      <div className="w-full max-w-md">
        <TkxCard variant="elevated" padding="lg">
          <TkxCardHeader title={`${expired ? "⌛" : "⚠️"} ${title}`} />
          <TkxCardBody>
            <div className="space-y-4">
              <TkxAlert
                variant="danger"
                title={expired ? "Link no longer valid" : "Verification failed"}
              >
                {expired
                  ? `Ask your ${isTeam ? "colleague" : "broker"} to send a fresh invite link — they're valid for 14 days.`
                  : reason || "The link may be malformed or have been tampered with."}
              </TkxAlert>
              <div className="flex justify-between text-xs">
                <Link href="/signup" className="text-gray-500 hover:underline">
                  ← Start a new brokerage instead
                </Link>
                <Link href="/login" className="text-brand font-medium hover:underline">
                  I already have an account
                </Link>
              </div>
            </div>
          </TkxCardBody>
        </TkxCard>
      </div>
    </main>
  );
}
