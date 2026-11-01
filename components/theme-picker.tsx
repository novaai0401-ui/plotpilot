"use client";

import { useState } from "react";
import { csrfFetch } from "@/lib/security/csrf-fetch";
import { useRouter } from "next/navigation";
import type { ThemeMode } from "@/lib/theme";
import { useT } from "@/lib/i18n/client";

/**
 * Three-state theme picker — Light / Dark / Auto.
 *
 * `auto` follows the OS preference via prefers-color-scheme. The server only
 * knows the cookie value, so it resolves `auto` to `light` for SSR; we let
 * the client pick up the real OS preference on hydration via a small effect.
 *
 * Persistence is via the /api/theme cookie endpoint, not localStorage — so
 * the next server render of any page can pick up the right tokens before
 * React hydrates (avoiding flash-of-wrong-theme).
 */
export function ThemePicker({ current }: { current: ThemeMode }) {
  const router = useRouter();
  const t = useT();
  const [busy, setBusy] = useState<ThemeMode | null>(null);

  async function setMode(mode: ThemeMode) {
    if (busy || mode === current) return;
    setBusy(mode);
    try {
      await csrfFetch("/api/theme", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ mode }),
      });
      // Refresh the RSC tree so layout.tsx re-reads the cookie and passes the
      // new theme down to <ThemeProvider>. router.refresh keeps client state
      // intact (unlike a full reload).
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  const options: Array<{ value: ThemeMode; label: string; icon: string }> = [
    { value: "light", label: t("account.theme.light"), icon: "☀" },
    { value: "dark", label: t("account.theme.dark"), icon: "☾" },
    { value: "auto", label: t("account.theme.auto"), icon: "⌬" },
  ];

  return (
    <div
      role="radiogroup"
      aria-label={t("account.theme.label")}
      aria-busy={busy !== null}
      className="inline-flex border rounded overflow-hidden text-xs"
    >
      {options.map((opt) => {
        const isActive = opt.value === current;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={isActive}
            disabled={busy !== null}
            onClick={() => setMode(opt.value)}
            title={opt.label}
            className={
              "px-2 py-1 transition-colors disabled:opacity-50 " +
              (isActive
                ? "bg-brand text-white"
                : "bg-white text-gray-600 hover:bg-gray-50")
            }
          >
            <span aria-hidden>{opt.icon}</span>
            <span className="sr-only">{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
}
