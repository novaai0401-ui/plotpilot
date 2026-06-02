"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export function ClaimLeadButton({ designId }: { designId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [sendInvite, setSendInvite] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function onClaim() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/leads/${designId}/claim`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sendInvite }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Claim failed");
      // If the WhatsApp send returned a deeplink URL, open it for the broker to hit Send.
      if (j.invite?.openUrl) {
        window.open(j.invite.openUrl, "_blank", "noopener,noreferrer");
      }
      router.refresh();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <button
        onClick={onClaim}
        disabled={busy}
        className="text-xs bg-teal-600 hover:bg-teal-500 disabled:opacity-50 px-2 py-1 rounded text-white"
      >
        {busy ? "Claiming…" : "Claim + invite"}
      </button>
      <label className="text-[10px] text-gray-400 flex items-center gap-1">
        <input
          type="checkbox"
          checked={sendInvite}
          onChange={(e) => setSendInvite(e.target.checked)}
          className="scale-75"
        />
        send WhatsApp now
      </label>
      {error && <div className="text-[10px] text-red-400">{error}</div>}
    </div>
  );
}
