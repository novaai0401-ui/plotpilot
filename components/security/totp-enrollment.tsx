"use client";
import { useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/auth/supabase-browser";
import { useLocale, useT } from "@/lib/i18n/client";
import { formatDate } from "@/lib/i18n/format";

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
  const t = useT();
  const locale = useLocale();
  const [noFactorsBefore, noFactorsAfter] = t("account.security.noFactors").split("{enroll}");
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
    if (!data) return setError(t("account.security.noEnrollmentData"));
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
      return setError(chalErr?.message || t("account.security.challengeFailed"));
    }
    const { error: verifyErr } = await supabase.auth.mfa.verify({
      factorId: enrolling.factorId,
      challengeId: chal.id,
      code,
    });
    setBusy(false);
    if (verifyErr) return setError(verifyErr.message);
    setInfo(t("account.security.enabled"));
    setEnrolling(null);
    setCode("");
    refresh();
  }

  async function onRemove(factorId: string) {
    if (!confirm(t("account.security.removeConfirm"))) return;
    setError(null);
    setBusy(true);
    const { error } = await supabase.auth.mfa.unenroll({ factorId });
    setBusy(false);
    if (error) return setError(error.message);
    setInfo(t("account.security.removed"));
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
        <div className="text-sm text-gray-500">{t("common.loading")}</div>
      ) : factors.length === 0 ? (
        <div className="text-sm text-gray-600">
          {noFactorsBefore}
          <strong>{t("account.security.enroll")}</strong>
          {noFactorsAfter}
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
                  <span className="text-xs text-gray-500">({t(`account.security.status.${f.status}`)})</span>
                </div>
                <div className="text-xs text-gray-500">
                  {f.created_at ? t("account.security.enrolledOn", { date: formatDate(f.created_at, locale) }) : ""}
                </div>
              </div>
              <button
                onClick={() => onRemove(f.id)}
                disabled={busy}
                className="text-xs text-red-600 hover:underline disabled:opacity-50"
              >
                {t("account.security.remove")}
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
          {busy ? t("account.security.working") : t("account.security.enrollButton")}
        </button>
      ) : (
        <form onSubmit={onVerify} className="bg-gray-50 border rounded p-4 space-y-3">
          <div>
            <div className="text-sm font-medium mb-1">{t("account.security.step1")}</div>
            <img src={enrolling.qr} alt={t("account.security.qrAlt")} className="bg-white p-2 border rounded inline-block" />
          </div>
          <div className="text-xs text-gray-600">
            {t("account.security.manualSecret")}{" "}
            <code className="bg-white border px-1 rounded">{enrolling.secret}</code>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">{t("account.security.step2")}</label>
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
              {busy ? t("account.security.verifying") : t("account.security.verifyEnable")}
            </button>
            <button
              type="button"
              onClick={() => {
                setEnrolling(null);
                setCode("");
              }}
              className="text-sm text-gray-500 hover:underline"
            >
              {t("common.cancel")}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
