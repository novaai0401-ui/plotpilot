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
import { useLocale, useT } from "@/lib/i18n/client";
import { formatDate } from "@/lib/i18n/format";

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
  if (preview && preview.status !== "valid") {
    return <InviteErrorScreen preview={preview} />;
  }
  return <ValidSignupForm preview={preview} />;
}

function ValidSignupForm({ preview }: { preview: InvitePreview }) {
  const router = useRouter();
  const params = useSearchParams();
  const t = useT();
  const locale = useLocale();
  const inviteToken = params.get("invite");
  const teamToken = params.get("team");

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
      if (!res.ok) {
        setError(json.error || t("common.somethingWrong"));
        return;
      }

      // Session cookie is already set. Show "check your inbox" briefly so
      // the user knows the verification email is coming, then forward.
      setPendingEmail(email);
      setTimeout(() => {
        router.push(nextPath);
        router.refresh();
      }, 1500);
    } catch {
      setError(t("common.somethingWrong"));
    } finally {
      setLoading(false);
    }
  }

  if (pendingEmail) {
    const [sentBefore, sentAfter] = t(
      inviteToken ? "public.signup.confirmationBody.portal" : "public.signup.confirmationBody.dashboard"
    ).split("{email}");
    return (
      <main className="min-h-screen flex items-center justify-center bg-gray-50 px-4 py-12">
        <div className="w-full max-w-md">
          <TkxCard variant="elevated" padding="lg">
            <TkxCardHeader
              title={`📬 ${t("public.signup.checkInbox")}`}
              subtitle={t("public.signup.oneLastStep")}
            />
            <TkxCardBody>
              <div className="space-y-4">
                <TkxAlert variant="info" title={t("public.signup.confirmationSent")}>
                  {sentBefore}
                  <strong>{pendingEmail}</strong>
                  {sentAfter}
                </TkxAlert>
                <p className="text-xs text-gray-500">
                  <strong>{t("public.signup.notReceived")}</strong> {t("public.signup.notReceivedHelp")}
                </p>
                <div className="flex justify-between text-xs">
                  <button
                    type="button"
                    onClick={() => setPendingEmail(null)}
                    className="text-gray-500 hover:underline"
                  >
                    ← {t("public.signup.differentEmail")}
                  </button>
                  <Link href="/login" className="text-brand font-medium hover:underline">
                    {t("public.signup.alreadyConfirmed")}
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
    ? t(verifiedTeam.role === "broker_admin" ? "public.signup.titleTeamAdmin" : "public.signup.titleTeamAgent")
    : verifiedClient
    ? t("public.signup.titleClient")
    : t("public.signup.titleOrg");
  const subtitle = verifiedTeam
    ? t("public.signup.subtitleTeam")
    : verifiedClient
    ? t("public.signup.subtitleClient")
    : t("public.signup.subtitleOrg");
  const [issuedBefore, issuedAfter] = t("public.signup.inviteIssuedTo").split("{email}");
  const [validBefore, validAfter] = t("public.signup.inviteValidUntil").split("{date}");

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
                <TkxAlert
                  variant="success"
                  title={t("public.signup.joiningOrg", { org: verifiedTeam.orgName })}
                >
                  {t("public.signup.role")} <strong>{t(`role.${verifiedTeam.role}`)}</strong> ·{" "}
                  {issuedBefore}
                  <code>{verifiedTeam.email}</code>
                  {issuedAfter}
                </TkxAlert>
              )}
              {verifiedClient && (
                <TkxAlert
                  variant="success"
                  title={t("public.signup.joiningAsClient", { org: verifiedClient.orgName })}
                >
                  {validBefore}
                  <strong>{formatDate(verifiedClient.expiresAt, locale)}</strong>
                  {validAfter}
                </TkxAlert>
              )}

              {/* aria-live wrapper for sign-up errors — see login-inner.tsx for rationale. */}
              <div aria-live="polite" aria-atomic="true">
                {error && (
                  <TkxAlert variant="danger" title={t("public.signup.failed")}>
                    {error}
                  </TkxAlert>
                )}
              </div>

              {!inviteToken && !teamToken && (
                <TkxInput
                  label={t("public.signup.brokerageName")}
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                  placeholder={t("public.signup.brokeragePlaceholder")}
                  isRequired
                />
              )}

              <TkxInput
                label={t("public.signup.yourName")}
                value={name}
                onChange={(e) => setName(e.target.value)}
                isRequired
                autoComplete="name"
              />

              <TkxInput
                label={t("public.signup.phoneLabel")}
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+919876543210"
                isRequired
                autoComplete="tel"
              />

              <TkxInput
                label={t("common.email")}
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                isRequired
                readOnly={Boolean(verifiedTeam)}
                hint={
                  verifiedTeam
                    ? t("public.signup.emailLockedHint")
                    : undefined
                }
                autoComplete="email"
              />

              <TkxInput
                label={t("login.password")}
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
                loadingText={t("public.signup.creatingAccount")}
                disabled={loading}
              >
                {t("public.signup.createAccount")}
              </TkxButton>

              <div className="text-xs text-gray-500 text-center">
                {t("public.signup.haveAccount")}{" "}
                <Link href="/login" className="text-brand font-medium">
                  {t("login.signIn")}
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
  const t = useT();
  const isTeam = preview.kind === "team";
  const expired = preview.status === "expired";
  const reason = preview.status === "invalid" ? preview.reason : null;
  const title = expired
    ? t("public.invite.expiredTitle")
    : isTeam
    ? t("public.invite.unverifiedTeamTitle")
    : t("public.invite.unverifiedClientTitle");

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50 px-4 py-12">
      <div className="w-full max-w-md">
        <TkxCard variant="elevated" padding="lg">
          <TkxCardHeader title={`${expired ? "⌛" : "⚠️"} ${title}`} />
          <TkxCardBody>
            <div className="space-y-4">
              <TkxAlert
                variant="danger"
                title={expired ? t("public.invite.linkInvalid") : t("public.invite.verificationFailed")}
              >
                {expired
                  ? t(isTeam ? "public.invite.askColleague" : "public.invite.askBroker")
                  : reason || t("public.invite.malformed")}
              </TkxAlert>
              <div className="flex justify-between text-xs">
                <Link href="/signup" className="text-gray-500 hover:underline">
                  ← {t("public.invite.startNew")}
                </Link>
                <Link href="/login" className="text-brand font-medium hover:underline">
                  {t("public.invite.haveAccount")}
                </Link>
              </div>
            </div>
          </TkxCardBody>
        </TkxCard>
      </div>
    </main>
  );
}
