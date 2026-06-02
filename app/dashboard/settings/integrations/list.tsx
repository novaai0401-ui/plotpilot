"use client";

import { useState } from "react";
import {
  TkxAlert,
  TkxButton,
  TkxCard,
  TkxCardBody,
} from "@/components/tkx-dyn";

type ScopeRow = { name: string; label: string; sensitivity: string };
type TokenRow = {
  id: string;
  appId: string;
  appName: string;
  appDescription: string | null;
  appHomepage: string | null;
  tokenLast4: string;
  scopes: ScopeRow[];
  createdAt: string;
  lastUsedAt: string | null;
  expiresAt: string | null;
};

export function IntegrationsList({ tokens: initial }: { tokens: TokenRow[] }) {
  const [tokens, setTokens] = useState(initial);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function revoke(t: TokenRow) {
    if (!confirm(`Revoke ${t.appName}? It will lose access immediately.`)) return;
    setBusyId(t.id);
    setError(null);
    try {
      const res = await fetch(`/api/integrations/${t.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || `HTTP ${res.status}`);
      setTokens((prev) => prev.filter((x) => x.id !== t.id));
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusyId(null);
    }
  }

  if (tokens.length === 0) {
    return (
      <TkxCard variant="outlined" padding="lg">
        <TkxCardBody>
          <div className="text-center text-sm text-gray-500 space-y-1">
            <div className="text-4xl" aria-hidden>🔒</div>
            <p className="font-medium text-gray-700">No authorized apps yet.</p>
            <p className="text-xs">
              When you approve a third-party app from a consent screen, it'll show up here.
            </p>
          </div>
        </TkxCardBody>
      </TkxCard>
    );
  }

  return (
    <div className="space-y-3">
      {error && (
        <TkxAlert variant="danger" title="Revoke failed">
          {error}
        </TkxAlert>
      )}
      {tokens.map((t) => (
        <div key={t.id} className="bg-white border rounded-lg p-4 text-sm">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="font-medium flex items-center gap-2">
                {t.appName}
                <span className="text-xs text-gray-400">· token ending in {t.tokenLast4}</span>
              </div>
              {t.appDescription && (
                <div className="text-xs text-gray-500 mt-0.5">{t.appDescription}</div>
              )}
              <div className="mt-2 text-xs space-y-1">
                <div>
                  <span className="text-gray-500">Granted:</span>{" "}
                  {new Date(t.createdAt).toLocaleString()}
                </div>
                {t.lastUsedAt && (
                  <div>
                    <span className="text-gray-500">Last used:</span>{" "}
                    {new Date(t.lastUsedAt).toLocaleString()}
                  </div>
                )}
                {t.expiresAt && (
                  <div>
                    <span className="text-gray-500">Expires:</span>{" "}
                    {new Date(t.expiresAt).toLocaleString()}
                  </div>
                )}
              </div>

              <div className="mt-2">
                <div className="text-xs text-gray-500 mb-1">Permissions:</div>
                <ul className="text-xs space-y-0.5">
                  {t.scopes.map((s) => (
                    <li key={s.name} className="flex items-center gap-2">
                      <span aria-hidden className="text-emerald-600">✓</span>
                      <span className="flex-1">{s.label}</span>
                      <span
                        className={
                          "text-[10px] uppercase tracking-wide px-1 py-0.5 rounded " +
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
            </div>
            <div className="flex flex-col items-end gap-2">
              <TkxButton
                type="button"
                variant="ghost"
                colorScheme="danger"
                size="sm"
                disabled={busyId === t.id}
                isLoading={busyId === t.id}
                loadingText="Revoking…"
                onClick={() => revoke(t)}
              >
                Revoke
              </TkxButton>
              {t.appHomepage && (
                <a className="text-xs text-brand hover:underline" href={t.appHomepage} target="_blank" rel="noopener noreferrer">
                  About →
                </a>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
