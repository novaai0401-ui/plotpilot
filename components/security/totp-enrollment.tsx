"use client";
import { useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/auth/supabase-browser";

type FactorRow = {
  id: string;
  friendly_name?: string | null;
  factor_type: string;
  status: string;
  created_at?: string;
};

/**
 * Client-side TOTP enrollment via Supabase Auth's MFA API.
 *
 * Flow:
 *   1. listFactors() — show existing factors with "remove" buttons.
 *   2. enroll() — show QR + secret. User scans, types the 6-digit code.
 *   3. challenge() + verify() — confirms the factor; Supabase marks it `verified`.
 */
export function TotpEnrollment() {
  const supabase = createSupabaseBrowserClient();
  const [factors, setFactors] = useState<FactorRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [enrolling, setEnrolling] = useState<{
    factorId: string;
    qr: string;
    secret: string;
  } | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  async function refresh() {
    setLoading(true);
    const { data, error } = await supabase.auth.mfa.listFactors();
    setLoading(false);
    if (error) return setError(error.message);
    const totps = ((data?.totp || []) as any[]).map((f) => ({
      id: f.id,
      friendly_name: f.friendly_name,
      factor_type: f.factor_type,
      status: f.status,
      created_at: f.created_at,
    }));
    setFactors(totps);
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onEnroll() {
    setError(null);
    setBusy(true);
    const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp" });
    setBusy(false);
    if (error) return setError(error.message);
    if (!data) return setError("No enrollment data returned.");
    setEnrolling({
      factorId: data.id,
      qr: data.totp.qr_code,
      secret: data.totp.secret,
    });
  }

  async function onVerify(e: React.FormEvent) {
    e.preventDefault();
    if (!enrolling) return;
    setError(null);
    setBusy(true);
    const { data: chal, error: chalErr } = await supabase.auth.mfa.challenge({
      factorId: enrolling.factorId,
    });
    if (chalErr || !chal) {
      setBusy(false);
      return setError(chalErr?.message || "Could not start challenge.");
    }
    const { error: verifyErr } = await supabase.auth.mfa.verify({
      factorId: enrolling.factorId,
      challengeId: chal.id,
      code,
    });
    setBusy(false);
    if (verifyErr) return setError(verifyErr.message);
    setInfo("✓ 2FA enabled. You'll be asked for a code on next login.");
    setEnrolling(null);
    setCode("");
    refresh();
  }

  async function onRemove(factorId: string) {
    if (!confirm("Remove this 2FA factor? You'll lose this second-factor protection.")) return;
    setError(null);
    setBusy(true);
    const { error } = await supabase.auth.mfa.unenroll({ factorId });
    setBusy(false);
    if (error) return setError(error.message);
    setInfo("Factor removed.");
    refresh();
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="p-3 text-sm bg-red-50 text-red-700 rounded border border-red-200">{error}</div>
      )}
      {info && (
        <div className="p-3 text-sm bg-green-50 text-green-800 rounded border border-green-200">{info}</div>
      )}

      {loading ? (
        <div className="text-sm text-gray-500">Loading…</div>
      ) : factors.length === 0 ? (
        <div className="text-sm text-gray-600">
          No 2FA factors enrolled. Click <strong>Enroll</strong> below to set up your first one.
        </div>
      ) : (
        <div className="border rounded">
          {factors.map((f) => (
            <div
              key={f.id}
              className="p-3 flex justify-between items-center border-b last:border-b-0 text-sm"
            >
              <div>
                <div className="font-medium">
                  {f.friendly_name || "TOTP"}{" "}
                  <span className="text-xs text-gray-500">({f.status})</span>
                </div>
                <div className="text-xs text-gray-500">
                  {f.created_at ? `Enrolled ${new Date(f.created_at).toLocaleDateString()}` : ""}
                </div>
              </div>
              <button
                onClick={() => onRemove(f.id)}
                disabled={busy}
                className="text-xs text-red-600 hover:underline disabled:opacity-50"
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      )}

      {!enrolling ? (
        <button
          onClick={onEnroll}
          disabled={busy}
          className="bg-brand text-white px-4 py-2 rounded text-sm hover:bg-brand-dark disabled:opacity-50"
        >
          {busy ? "Working…" : "+ Enroll authenticator"}
        </button>
      ) : (
        <form onSubmit={onVerify} className="bg-gray-50 border rounded p-4 space-y-3">
          <div>
            <div className="text-sm font-medium mb-1">1. Scan this QR with your authenticator app:</div>
            <img src={enrolling.qr} alt="TOTP QR" className="bg-white p-2 border rounded inline-block" />
          </div>
          <div className="text-xs text-gray-600">
            Or type the secret manually:{" "}
            <code className="bg-white border px-1 rounded">{enrolling.secret}</code>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">2. Enter the 6-digit code:</label>
            <input
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              pattern="[0-9]{6}"
              required
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              className="w-32 border rounded px-3 py-2 text-lg font-mono tracking-wider"
            />
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={busy || code.length !== 6}
              className="bg-brand text-white px-4 py-2 rounded text-sm disabled:opacity-50"
            >
              {busy ? "Verifying…" : "Verify & enable"}
            </button>
            <button
              type="button"
              onClick={() => {
                setEnrolling(null);
                setCode("");
              }}
              className="text-sm text-gray-500 hover:underline"
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
