"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export function MarkAllReadButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        await fetch("/api/notifications/mark-all-read", { method: "POST" });
        router.refresh();
        setBusy(false);
      }}
      className="text-xs text-brand hover:underline"
    >
      Mark all read
    </button>
  );
}
