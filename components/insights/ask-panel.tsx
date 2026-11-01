"use client";

import { useState, type FormEvent } from "react";
import { TkxButton, TkxCard, TkxCardBody, TkxCardHeader, TkxInput } from "@/components/tkx-dyn";
import { translate, type Locale } from "@/lib/i18n/dict";
import { TOPICS, type Topic } from "@/lib/insights/intent-model";
import { csrfFetch } from "@/lib/security/csrf-fetch";

type Turn = { question: string; answer: string; needsTopic: boolean; learned?: boolean };

const EXAMPLES = ["insights.ask.example1", "insights.ask.example2", "insights.ask.example3"];

export function AskPanel({ period, locale }: { period: string; locale: Locale }) {
  const [question, setQuestion] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const tr = (key: string) => translate(key, locale);

  async function post(url: string, payload: object) {
    const res = await csrfFetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...payload, period }),
    });
    if (!res.ok) throw new Error();
    return res.json();
  }

  async function ask(q: string) {
    if (!q.trim() || loading) return;
    setLoading(true);
    setError(null);
    try {
      const data = await post("/api/insights/ask", { question: q });
      setTurns((list) => [{ question: q, answer: data.answer, needsTopic: data.needsTopic }, ...list].slice(0, 5));
      setQuestion("");
    } catch {
      setError(tr("insights.ask.failed"));
    } finally {
      setLoading(false);
    }
  }

  async function teach(turn: Turn, topic: Topic) {
    setLoading(true);
    setError(null);
    try {
      const data = await post("/api/insights/teach", { question: turn.question, topic });
      setTurns((list) =>
        list.map((t) => (t === turn ? { ...t, answer: data.answer, needsTopic: false, learned: true } : t))
      );
    } catch {
      setError(tr("insights.ask.failed"));
    } finally {
      setLoading(false);
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    ask(question);
  }

  return (
    <TkxCard padding="md">
      <TkxCardHeader title={tr("insights.ask.title")} />
      <TkxCardBody>
        <form onSubmit={onSubmit} style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <TkxInput
              label={tr("insights.ask.label")}
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              maxLength={500}
              placeholder={tr("insights.ask.placeholder")}
            />
          </div>
          <TkxButton type="submit" isLoading={loading} disabled={!question.trim()}>
            {tr("insights.ask.button")}
          </TkxButton>
        </form>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 10 }}>
          {EXAMPLES.map((key) => (
            <TkxButton key={key} type="button" size="sm" variant="ghost" onClick={() => ask(tr(key))}>
              {tr(key)}
            </TkxButton>
          ))}
        </div>

        <div aria-live="polite" style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 12 }}>
          {error && <p className="text-sm text-red-700">{error}</p>}
          {turns.map((turn, i) => (
            <div key={`${turn.question}-${i}`} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <p className="text-sm text-gray-500" style={{ alignSelf: "flex-end" }}>{turn.question}</p>
              <p className="p-3 bg-teal-50 rounded-lg text-base text-gray-800 whitespace-pre-line">{turn.answer}</p>
              {turn.needsTopic && (
                <div>
                  <p className="text-sm font-medium mb-1">{tr("insights.teach.prompt")}</p>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {TOPICS.map((topic) => (
                      <TkxButton
                        key={topic}
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={loading}
                        onClick={() => teach(turn, topic)}
                      >
                        {tr(`insights.topic.${topic}`)}
                      </TkxButton>
                    ))}
                  </div>
                </div>
              )}
              {turn.learned && <p className="text-xs text-green-700">{tr("insights.teach.learned")}</p>}
            </div>
          ))}
        </div>
      </TkxCardBody>
    </TkxCard>
  );
}
