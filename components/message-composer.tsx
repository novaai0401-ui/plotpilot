"use client";
import { useState } from "react";
import { csrfFetch } from "@/lib/security/csrf-fetch";
import { useRouter } from "next/navigation";
import { developerToolsEnabled } from "@/lib/developer-tools";
import { useT } from "@/lib/i18n/client";

type Props = {
  recipientId: string;
  recipientName: string;
  recipientPhone: string;
  visitId?: string;
  defaultBody?: string;
};

/**
 * Lets a broker compose a WhatsApp message.
 * - Logs the Message row server-side via /api/messages/send.
 * - For deeplink channels, opens wa.me in a new tab.
 */
export function MessageComposer(props: Props) {
  const router = useRouter();
  const t = useT();
  const [body, setBody] = useState(props.defaultBody || "");
  const [preference, setPreference] = useState<"auto" | "deeplink" | "business_api">("auto");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSend() {
    setBusy(true);
    setError(null);
    const res = await csrfFetch("/api/messages/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        recipientId: props.recipientId,
        body,
        visitId: props.visitId,
        preference,
      }),
    });
    setBusy(false);
    const j = await res.json().catch(() => ({}));
    if (!res.ok || !j.ok) {
      setError(j.error || t("broker.composer.sendFailed"));
      return;
    }
    if (j.openUrl) {
      window.open(j.openUrl, "_blank", "noopener,noreferrer");
    }
    router.refresh();
  }

  return (
    <div className="bg-white border rounded-lg p-4 space-y-3">
      <div className="text-sm text-gray-500">
        {t("broker.composer.to")} <strong>{props.recipientName}</strong> ({props.recipientPhone})
      </div>
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={4}
        className="w-full border rounded px-3 py-2 text-sm"
      />
      <div className="flex items-center justify-end gap-3 text-xs">
        {developerToolsEnabled() && (
          <label className="flex items-center gap-2 mr-auto">
            {t("broker.composer.channel")}
            <select
              value={preference}
              onChange={(e) => setPreference(e.target.value as any)}
              className="border rounded px-2 py-1"
            >
              <option value="auto">{t("broker.composer.channelAuto")}</option>
              <option value="deeplink">{t("broker.composer.channelDeeplink")}</option>
              <option value="business_api">{t("broker.composer.channelBusinessApi")}</option>
            </select>
          </label>
        )}
        <button
          onClick={onSend}
          disabled={busy || !body.trim()}
          className="bg-brand text-white px-4 py-2 rounded text-sm hover:bg-brand-dark disabled:opacity-50"
        >
          {busy ? t("common.sending") : t("common.send")}
        </button>
      </div>
      {error && <div className="text-xs text-red-600">{error}</div>}
    </div>
  );
}
