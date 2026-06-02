"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { LOCALES, LOCALE_LABELS, type Locale } from "@/lib/i18n/dict";

/**
 * Small dropdown that writes the locale cookie and reloads.
 * Mounted in the dashboard sidebar; could also go in the landing-page header.
 */
export function LocalePicker({ current }: { current: Locale }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function onChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const locale = e.target.value;
    if (locale === current) return;
    setBusy(true);
    await fetch("/api/i18n/set-locale", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ locale }),
    });
    // Full reload: server components re-render with the new cookie.
    router.refresh();
    setBusy(false);
  }

  return (
    <select
      value={current}
      onChange={onChange}
      disabled={busy}
      aria-busy={busy}
      className="text-xs border rounded px-1.5 py-0.5 bg-white"
      aria-label="Language"
    >
      {LOCALES.map((l) => (
        <option key={l} value={l}>
          {LOCALE_LABELS[l]}
        </option>
      ))}
    </select>
  );
}
