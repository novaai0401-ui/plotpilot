"use client";
import { useState } from "react";

/**
 * Read the live values of the WhatsApp credential inputs and probe Meta's Graph API
 * to verify they work — without saving them or sending a real message.
 *
 * Returns a friendly result message so the broker can troubleshoot inline before
 * committing the settings update.
 */
export function WhatsAppTestButton() {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<
    | null
    | { ok: true; phoneNumber?: string; verifiedName?: string; message: string }
    | { ok: false; error: string }
  >(null);

  async function onClick() {
    setBusy(true);
    setResult(null);
    // Read the latest form values directly from the DOM (we're inside the same form)
    const phoneNumberId =
      (document.querySelector('input[name="phoneNumberId"]') as HTMLInputElement)?.value || "";
    const accessTokenRaw =
      (document.querySelector('input[name="accessToken"]') as HTMLInputElement)?.value || "";

    if (accessTokenRaw === "******") {
      setBusy(false);
      setResult({
        ok: false,
        error:
          "Test requires the actual token (we don't decrypt the stored one for testing). Paste a fresh token to verify, or save without testing.",
      });
      return;
    }
    if (!phoneNumberId || !accessTokenRaw) {
      setBusy(false);
      setResult({ ok: false, error: "Fill both phoneNumberId and accessToken first." });
      return;
    }

    try {
      const res = await fetch("/api/whatsapp/test-connection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phoneNumberId, accessToken: accessTokenRaw }),
      });
      const j = await res.json();
      setResult(j);
    } catch (e: any) {
      setResult({ ok: false, error: e?.message || "Network error." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={onClick}
        disabled={busy}
        className="text-xs px-3 py-1.5 border rounded bg-white hover:bg-gray-50 disabled:opacity-50"
      >
        {busy ? "Testing…" : "🧪 Test connection (free, no message sent)"}
      </button>
      {result && (
        <div
          className={`mt-2 p-3 rounded text-xs ${
            result.ok
              ? "bg-green-50 border border-green-200 text-green-900"
              : "bg-red-50 border border-red-200 text-red-900"
          }`}
        >
          {result.ok ? (
            <>
              <strong>✓ {result.message}</strong>
              {result.phoneNumber && (
                <div className="mt-1 text-green-700">
                  Phone: {result.phoneNumber} {result.verifiedName ? `· ${result.verifiedName}` : ""}
                </div>
              )}
            </>
          ) : (
            <>
              <strong>✗ Failed:</strong> {result.error}
            </>
          )}
        </div>
      )}
    </div>
  );
}
