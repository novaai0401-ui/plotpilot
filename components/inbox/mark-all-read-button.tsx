"use client";
import { useState } from "react";
import { csrfFetch } from "@/lib/security/csrf-fetch";
import { useRouter } from "next/navigation";
import { useT } from "@/lib/i18n/client";

export function MarkAllReadButton() {
  const router = useRouter();
  const t = useT();
  const [busy, setBusy] = useState(false);
  return (
    <button
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        await csrfFetch("/api/notifications/mark-all-read", { method: "POST" });
        router.refresh();
        setBusy(false);
      }}
      className="text-xs text-brand hover:underline"
    >
      {t("broker.inbox.markAllRead")}
    </button>
  );
}
