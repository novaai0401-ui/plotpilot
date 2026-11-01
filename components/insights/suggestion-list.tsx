"use client";

import { useState } from "react";
import Link from "next/link";
import { TkxButton, TkxEmpty, useToast } from "@/components/tkx-dyn";
import { translate, type Locale } from "@/lib/i18n/dict";
import { csrfFetch } from "@/lib/security/csrf-fetch";

export type SuggestionItem = { id: string; title: string; body: string; link: string | null };

export function SuggestionList({ suggestions, locale }: { suggestions: SuggestionItem[]; locale: Locale }) {
  const [items, setItems] = useState(suggestions);
  const { toast } = useToast();
  const tr = (key: string) => translate(key, locale);

  async function decide(id: string, decision: "accepted" | "dismissed") {
    const previous = items;
    setItems((list) => list.filter((s) => s.id !== id));
    try {
      const res = await csrfFetch(`/api/insights/suggestions/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision }),
      });
      if (!res.ok) throw new Error();
      toast({ title: tr("insights.thanks"), variant: "success" });
    } catch {
      setItems(previous);
      toast({ title: tr("insights.saveFailed"), variant: "danger" });
    }
  }

  if (items.length === 0) return <TkxEmpty description={tr("insights.noSuggestions")} />;

  return (
    <ul style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {items.map((s) => (
        <li key={s.id}>
          {s.link ? (
            <Link href={s.link} className="text-sm font-medium hover:underline">{s.title}</Link>
          ) : (
            <div className="text-sm font-medium">{s.title}</div>
          )}
          <div className="text-xs text-gray-500">{s.body}</div>
          <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
            <TkxButton type="button" size="sm" variant="outline" onClick={() => decide(s.id, "accepted")}>
              {tr("insights.done")}
            </TkxButton>
            <TkxButton type="button" size="sm" variant="ghost" onClick={() => decide(s.id, "dismissed")}>
              {tr("insights.notUseful")}
            </TkxButton>
          </div>
        </li>
      ))}
    </ul>
  );
}
