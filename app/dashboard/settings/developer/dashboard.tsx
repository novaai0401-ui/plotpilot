"use client";

import { useState } from "react";
import {
  TkxAlert,
  TkxButton,
  TkxCard,
  TkxCardBody,
  TkxCardHeader,
  TkxInput,
  TkxCheckbox,
} from "@/components/tkx-dyn";

type App = {
  id: string;
  name: string;
  description: string | null;
  clientId: string;
  redirectUris: string[];
  allowedScopes: string[];
  createdAt: string;
  activeTokens: number;
};

type ScopeRow = { name: string; label: string; sensitivity: string };

type CreatedApp = App & { clientSecret: string };

export function DeveloperDashboard({
  initialApps,
  scopeCatalog,
}: {
  initialApps: App[];
  scopeCatalog: ScopeRow[];
}) {
  const [apps, setApps] = useState<App[]>(initialApps);
  const [creating, setCreating] = useState(false);
  const [justCreated, setJustCreated] = useState<CreatedApp | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [homepageUrl, setHomepageUrl] = useState("");
  const [redirectInput, setRedirectInput] = useState("");
  const [redirectUris, setRedirectUris] = useState<string[]>([]);
  const [scopeNames, setScopeNames] = useState<string[]>([]);

  function reset() {
    setName(""); setDescription(""); setHomepageUrl("");
    setRedirectInput(""); setRedirectUris([]); setScopeNames([]);
  }

  function toggleScope(n: string) {
    setScopeNames((prev) => (prev.includes(n) ? prev.filter((s) => s !== n) : [...prev, n]));
  }

  function addRedirect() {
    const u = redirectInput.trim();
    if (!u) return;
    try {
      new URL(u);
    } catch {
      setError("Invalid URL");
      return;
    }
    if (!redirectUris.includes(u)) setRedirectUris([...redirectUris, u]);
    setRedirectInput("");
    setError(null);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setCreating(true);
    try {
      const res = await fetch("/api/developer/apps", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name, description: description || null, homepageUrl: homepageUrl || null,
          redirectUris, allowedScopes: scopeNames,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
      setJustCreated(json);
      setApps((prev) => [
        {
          id: json.id, name: json.name, description: null, clientId: json.clientId,
          redirectUris: json.redirectUris, allowedScopes: json.allowedScopes,
          createdAt: json.createdAt, activeTokens: 0,
        },
        ...prev,
      ]);
      reset();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setCreating(false);
    }
  }

  async function revoke(appId: string) {
    if (!confirm("Revoke this app? All issued tokens will be invalidated immediately.")) return;
    const res = await fetch(`/api/developer/apps/${appId}`, { method: "DELETE" });
    if (res.ok) setApps((prev) => prev.filter((a) => a.id !== appId));
  }

  return (
    <div className="space-y-6">
      {justCreated && (
        <TkxAlert variant="warning" title={`Copy your client_secret now — you won't see it again.`}>
          <div className="space-y-2 text-sm">
            <div>
              App created: <strong>{justCreated.name}</strong>
            </div>
            <SecretBlock label="client_id" value={justCreated.clientId} />
            <SecretBlock label="client_secret" value={justCreated.clientSecret} reveal />
            <p className="text-xs">
              Store the secret in your app's env. We only keep its sha256 hash — there's no way to recover it.
            </p>
            <div className="flex justify-end">
              <TkxButton type="button" variant="ghost" size="sm" onClick={() => setJustCreated(null)}>
                Dismiss
              </TkxButton>
            </div>
          </div>
        </TkxAlert>
      )}

      <TkxCard variant="elevated" padding="md">
        <TkxCardHeader title="Register a new app" subtitle="One-time setup per integration." />
        <TkxCardBody>
          <form onSubmit={submit} className="space-y-4">
            {error && (
              <TkxAlert variant="danger" title="Couldn't create app">
                {error}
              </TkxAlert>
            )}
            <TkxInput label="App name" value={name} onChange={(e) => setName(e.target.value)} isRequired placeholder="e.g. PlotPilot Mobile" />
            <TkxInput label="Description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What does the app do? (optional)" />
            <TkxInput label="Homepage URL" type="url" value={homepageUrl} onChange={(e) => setHomepageUrl(e.target.value)} placeholder="https://example.com (optional)" />

            <div>
              <label className="block text-sm font-medium mb-1">Redirect URIs</label>
              <p className="text-xs text-gray-500 mb-2">
                The exact callback URLs your app will use after authorization. Add as many as you need.
              </p>
              <div className="flex gap-2">
                <input
                  type="url"
                  value={redirectInput}
                  onChange={(e) => setRedirectInput(e.target.value)}
                  placeholder="https://app.example.com/oauth/callback"
                  className="flex-1 border rounded px-3 py-2 text-sm"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addRedirect();
                    }
                  }}
                />
                <TkxButton type="button" variant="outline" size="sm" onClick={addRedirect}>
                  Add
                </TkxButton>
              </div>
              {redirectUris.length > 0 && (
                <ul className="mt-2 space-y-1">
                  {redirectUris.map((u, i) => (
                    <li key={u} className="text-xs flex items-center justify-between border rounded px-2 py-1 bg-gray-50">
                      <code className="truncate">{u}</code>
                      <button
                        type="button"
                        onClick={() => setRedirectUris(redirectUris.filter((_, j) => j !== i))}
                        className="text-gray-500 hover:text-red-700 ml-2"
                      >
                        ×
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Allowed scopes</label>
              <p className="text-xs text-gray-500 mb-2">
                What this app is permitted to ask for. The user can grant fewer at consent time, never more.
              </p>
              <div className="grid sm:grid-cols-2 gap-1.5 max-h-60 overflow-y-auto border rounded p-2">
                {scopeCatalog.map((s) => (
                  <label key={s.name} className="flex items-start gap-2 text-xs">
                    <input
                      type="checkbox"
                      checked={scopeNames.includes(s.name)}
                      onChange={() => toggleScope(s.name)}
                      className="mt-0.5"
                    />
                    <span>
                      <code className="font-mono">{s.name}</code>
                      <span className="text-gray-500"> · {s.label}</span>
                    </span>
                  </label>
                ))}
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t">
              <TkxButton
                type="submit"
                variant="solid"
                colorScheme="primary"
                isLoading={creating}
                loadingText="Creating…"
                disabled={creating || !name || redirectUris.length === 0 || scopeNames.length === 0}
              >
                Create app
              </TkxButton>
            </div>
          </form>
        </TkxCardBody>
      </TkxCard>

      <section>
        <h2 className="text-lg font-semibold mb-3">Registered apps</h2>
        {apps.length === 0 ? (
          <div className="bg-white border rounded-lg p-6 text-center text-sm text-gray-500">
            No apps yet. Register your first one above.
          </div>
        ) : (
          <div className="space-y-3">
            {apps.map((a) => (
              <div key={a.id} className="bg-white border rounded-lg p-4 text-sm space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium">{a.name}</div>
                    {a.description && (
                      <div className="text-xs text-gray-500 mt-0.5">{a.description}</div>
                    )}
                    <div className="mt-2 grid grid-cols-1 gap-1 text-xs">
                      <div>
                        <span className="text-gray-500">client_id:</span>{" "}
                        <code className="font-mono">{a.clientId}</code>
                      </div>
                      <div>
                        <span className="text-gray-500">redirect_uri{a.redirectUris.length === 1 ? "" : "s"}:</span>{" "}
                        {a.redirectUris.map((u) => (
                          <code key={u} className="font-mono mr-2">{u}</code>
                        ))}
                      </div>
                      <div>
                        <span className="text-gray-500">scopes:</span>{" "}
                        {a.allowedScopes.map((s) => (
                          <span key={s} className="inline-block bg-gray-100 rounded px-1.5 py-0.5 text-[10px] mr-1 font-mono">
                            {s}
                          </span>
                        ))}
                      </div>
                      <div>
                        <span className="text-gray-500">{a.activeTokens} active token{a.activeTokens === 1 ? "" : "s"}</span>
                      </div>
                    </div>
                  </div>
                  <TkxButton type="button" variant="ghost" colorScheme="danger" size="sm" onClick={() => revoke(a.id)}>
                    Revoke
                  </TkxButton>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function SecretBlock({ label, value, reveal }: { label: string; value: string; reveal?: boolean }) {
  const [shown, setShown] = useState(!reveal);
  return (
    <div className="text-xs">
      <div className="text-gray-500 mb-1">{label}</div>
      <div className="flex items-center gap-2">
        <code className="font-mono bg-white border rounded px-2 py-1 break-all flex-1">
          {shown ? value : "•".repeat(Math.min(32, value.length))}
        </code>
        {reveal && (
          <button type="button" onClick={() => setShown((s) => !s)} className="text-xs text-brand">
            {shown ? "Hide" : "Show"}
          </button>
        )}
        <button
          type="button"
          onClick={() => navigator.clipboard.writeText(value)}
          className="text-xs text-brand"
        >
          Copy
        </button>
      </div>
    </div>
  );
}
