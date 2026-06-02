"use client";

import { useState } from "react";
import {
  TkxAlert,
  TkxButton,
  TkxCard,
  TkxCardBody,
  TkxCardHeader,
} from "@/components/tkx-dyn";
import type { ScopeDescriptor } from "@/lib/auth/oauth-scopes";

export function AuthorizeConsent({
  app,
  user,
  scopes,
  redirectUri,
  state,
}: {
  app: { id: string; clientId: string; name: string; description: string | null; homepageUrl: string | null; iconUrl: string | null };
  user: { name: string; email: string | null };
  scopes: ScopeDescriptor[];
  redirectUri: string;
  state: string;
}) {
  const [submitting, setSubmitting] = useState<"approve" | "deny" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function decide(action: "approve" | "deny") {
    setSubmitting(action);
    setError(null);
    try {
      const res = await fetch("/api/oauth/authorize", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          appId: app.id,
          action,
          scopes: scopes.map((s) => s.name),
          redirectUri,
          state,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
      // The server tells us where to bounce.
      window.location.href = json.location;
    } catch (e: any) {
      setError(e.message || "Authorization failed");
      setSubmitting(null);
    }
  }

  const hasSend = scopes.some((s) => s.sensitivity === "send");
  const hasWrite = scopes.some((s) => s.sensitivity === "write" || s.sensitivity === "send");

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50 px-4 py-8">
      <div className="w-full max-w-lg">
        <TkxCard variant="elevated" padding="lg">
          <TkxCardHeader
            title={`${app.name} wants to access your account`}
            subtitle={app.description ?? "Review the requested permissions below."}
          />
          <TkxCardBody>
            <div className="space-y-4">
              <div className="text-xs text-gray-500 border-b pb-3">
                Signed in as <strong>{user.name}</strong>
                {user.email ? ` (${user.email})` : ""}.
              </div>

              {hasSend && (
                <TkxAlert variant="warning" title="This app can act on your behalf">
                  Approving will let {app.name} send WhatsApp messages from your org.
                  Only approve apps you trust.
                </TkxAlert>
              )}

              <div>
                <h3 className="text-sm font-medium mb-2">It will be able to:</h3>
                <ul className="space-y-2">
                  {scopes.map((s) => (
                    <li
                      key={s.name}
                      className="flex items-start gap-2 text-sm border rounded p-2"
                    >
                      <span aria-hidden className="text-emerald-600">✓</span>
                      <div className="flex-1">
                        <div className="font-medium">{s.label}</div>
                        <div className="text-xs text-gray-500">{s.description}</div>
                      </div>
                      <span
                        className={
                          "text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded " +
                          (s.sensitivity === "send"
                            ? "bg-amber-100 text-amber-800"
                            : s.sensitivity === "write"
                              ? "bg-blue-100 text-blue-800"
                              : "bg-gray-100 text-gray-700")
                        }
                      >
                        {s.sensitivity}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>

              {!hasWrite && (
                <p className="text-xs text-gray-500">
                  All requested permissions are <strong>read-only</strong>. {app.name}{" "}
                  cannot change your data or send messages.
                </p>
              )}

              <p className="text-xs text-gray-500">
                You can revoke this access any time from{" "}
                <strong>Settings → Authorized apps</strong>. Tokens expire after 30 days.
              </p>

              {error && (
                <TkxAlert variant="danger" title="Couldn't complete authorization">
                  {error}
                </TkxAlert>
              )}

              <div className="flex justify-end gap-2 pt-2 border-t">
                <TkxButton
                  type="button"
                  variant="ghost"
                  colorScheme="secondary"
                  onClick={() => decide("deny")}
                  disabled={Boolean(submitting)}
                  isLoading={submitting === "deny"}
                  loadingText="Denying…"
                >
                  Deny
                </TkxButton>
                <TkxButton
                  type="button"
                  variant="solid"
                  colorScheme="primary"
                  onClick={() => decide("approve")}
                  disabled={Boolean(submitting)}
                  isLoading={submitting === "approve"}
                  loadingText="Authorizing…"
                >
                  Authorize {app.name}
                </TkxButton>
              </div>
            </div>
          </TkxCardBody>
        </TkxCard>

        {app.homepageUrl && (
          <p className="text-xs text-gray-500 text-center mt-4">
            About this app:{" "}
            <a className="text-brand hover:underline" href={app.homepageUrl} target="_blank" rel="noopener noreferrer">
              {new URL(app.homepageUrl).hostname}
            </a>
          </p>
        )}
      </div>
    </main>
  );
}
