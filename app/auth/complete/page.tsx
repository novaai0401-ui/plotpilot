"use client";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

/**
 * Recovery path: shown when /auth/callback exchanges the code successfully but
 * provisionUser() failed because the metadata stashed at signup wasn't there
 * (e.g., the user signed up via OAuth, or the metadata expired).
 *
 * Collects the missing fields and re-tries provision via /api/auth/provision.
 */
export default function AuthCompletePage() {
  // useSearchParams in App Router requires a Suspense boundary at build time.
  return (
    <Suspense>
      <AuthCompleteInner />
    </Suspense>
  );
}

function AuthCompleteInner() {
  const router = useRouter();
  const params = useSearchParams();
  const reason = params.get("reason");

  const [orgName, setOrgName] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setErr(null);
    const res = await fetch("/api/auth/provision", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orgName, name, phone }),
    });
    setSubmitting(false);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      return setErr(j.error || "Provisioning failed");
    }
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50 px-4 py-12">
      <form onSubmit={onSubmit} className="w-full max-w-md bg-white p-8 rounded-lg shadow-sm border space-y-4">
        <h1 className="text-2xl font-bold text-gray-900">Finish setup</h1>
        <p className="text-sm text-gray-500">
          We just need a few more details to finish setting up your organization.
        </p>
        {reason && (
          <div className="p-3 text-xs bg-yellow-50 border border-yellow-200 rounded text-yellow-900">
            <code>{reason}</code>
          </div>
        )}
        {err && (
          <div className="p-3 text-sm bg-red-50 text-red-700 rounded border border-red-200">{err}</div>
        )}
        <div>
          <label className="block text-sm font-medium mb-1">Brokerage name</label>
          <input required value={orgName} onChange={(e) => setOrgName(e.target.value)} className="w-full border rounded px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Your name</label>
          <input required value={name} onChange={(e) => setName(e.target.value)} className="w-full border rounded px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Phone (with country code)</label>
          <input required value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+919876543210" className="w-full border rounded px-3 py-2 text-sm" />
        </div>
        <button disabled={submitting} className="w-full py-2 bg-brand text-white rounded hover:bg-brand-dark disabled:opacity-50">
          {submitting ? "Saving..." : "Continue"}
        </button>
        <div className="text-xs text-gray-500 text-center">
          <Link href="/login" className="hover:underline">Sign in with a different account</Link>
        </div>
      </form>
    </main>
  );
}
