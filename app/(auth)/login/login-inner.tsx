"use client";
import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  TkxAlert,
  TkxButton,
  TkxCard,
  TkxCardBody,
  TkxCardHeader,
  TkxInput,
} from "@/components/tkx-dyn";

type Strings = {
  title: string;
  subtitle: string;
  email: string;
  password: string;
  signIn: string;
  signingIn: string;
  noOrg: string;
  startFree: string;
  failed: string;
  genericError: string;
  mfaTitle: string;
  mfaSubtitle: string;
  mfaFormLabel: string;
  codeLabel: string;
  codeHint: string;
  verify: string;
  verifying: string;
  differentAccount: string;
};

/** Only follow `from` within this site, so a crafted link can't send users elsewhere. */
function safeRedirect(from: string | null): string {
  return from && /^\/(?![/\\])/.test(from) ? from : "/dashboard";
}

type State =
  | { kind: "password" }
  | { kind: "mfa"; pendingMfaToken: string }
  | { kind: "done" };

export function LoginInner({ strings }: { strings: Strings }) {
  const router = useRouter();
  const params = useSearchParams();
  const [state, setState] = useState<State>({ kind: "password" });
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mfaCode, setMfaCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function csrfHeaders(): Record<string, string> {
    const csrf = typeof document !== "undefined"
      ? (document.cookie.match(/(^|; )csrf_token=([^;]+)/)?.[2])
      : undefined;
    return {
      "content-type": "application/json",
      ...(csrf ? { "x-csrf-token": decodeURIComponent(csrf) } : {}),
    };
  }

  async function onPasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/native/login", {
        method: "POST",
        headers: csrfHeaders(),
        body: JSON.stringify({ email, password }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || strings.genericError);
        return;
      }
      if (json.mfaRequired) {
        setState({ kind: "mfa", pendingMfaToken: json.pendingMfaToken });
      } else {
        router.push(safeRedirect(params.get("from")));
        router.refresh();
      }
    } catch {
      setError(strings.genericError);
    } finally {
      setLoading(false);
    }
  }

  async function onMfaSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (state.kind !== "mfa") return;
      const res = await fetch("/api/auth/native/login/mfa", {
        method: "POST",
        headers: csrfHeaders(),
        body: JSON.stringify({
          pendingMfaToken: state.pendingMfaToken,
          code: mfaCode,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || strings.genericError);
        return;
      }
      router.push(safeRedirect(params.get("from")));
      router.refresh();
    } catch {
      setError(strings.genericError);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm">
        <TkxCard variant="elevated" padding="lg">
          <TkxCardHeader
            title={state.kind === "mfa" ? strings.mfaTitle : strings.title}
            subtitle={
              state.kind === "mfa"
                ? strings.mfaSubtitle
                : strings.subtitle
            }
          />
          <TkxCardBody>
            <div aria-live="polite" aria-atomic="true">
              {error && (
                <TkxAlert variant="danger" title={strings.failed}>
                  {error}
                </TkxAlert>
              )}
            </div>

            {state.kind === "password" && (
              <form
                onSubmit={onPasswordSubmit}
                className="space-y-4"
                noValidate
                aria-label={strings.title}
              >
                <TkxInput
                  label={strings.email}
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  isRequired
                  autoComplete="email"
                />
                <TkxInput
                  label={strings.password}
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  isRequired
                  autoComplete="current-password"
                />
                <TkxButton
                  type="submit"
                  variant="solid"
                  colorScheme="primary"
                  isFullWidth
                  isLoading={loading}
                  loadingText={strings.signingIn}
                  disabled={loading}
                >
                  {strings.signIn}
                </TkxButton>
                <div className="text-xs text-gray-500 text-center">
                  {strings.noOrg}{" "}
                  <Link href="/signup" className="text-brand font-medium">
                    {strings.startFree}
                  </Link>
                </div>
              </form>
            )}

            {state.kind === "mfa" && (
              <form
                onSubmit={onMfaSubmit}
                className="space-y-4"
                noValidate
                aria-label={strings.mfaFormLabel}
              >
                <TkxInput
                  label={strings.codeLabel}
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]{6}"
                  maxLength={10}
                  value={mfaCode}
                  onChange={(e) => setMfaCode(e.target.value)}
                  isRequired
                  autoComplete="one-time-code"
                  hint={strings.codeHint}
                />
                <TkxButton
                  type="submit"
                  variant="solid"
                  colorScheme="primary"
                  isFullWidth
                  isLoading={loading}
                  loadingText={strings.verifying}
                  disabled={loading || mfaCode.length < 6}
                >
                  {strings.verify}
                </TkxButton>
                <button
                  type="button"
                  className="block w-full text-xs text-gray-500 hover:underline"
                  onClick={() => {
                    setMfaCode("");
                    setState({ kind: "password" });
                  }}
                >
                  ← {strings.differentAccount}
                </button>
              </form>
            )}
          </TkxCardBody>
        </TkxCard>
      </div>
    </main>
  );
}
