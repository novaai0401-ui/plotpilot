"use client";

import { useEffect, useState } from "react";
import {
  TkxAlert,
  TkxBadge,
  TkxButton,
  TkxCard,
  TkxCardBody,
  TkxCardHeader,
} from "@/components/tkx-dyn";

type Match = {
  clientId: string;
  clientName: string;
  score: number;
  phone: string | null;
  preferencesSummary: string;
  breakdown: Array<{
    dimension: string;
    weight: number;
    points: number;
    note: string;
  }>;
  ruledOut: boolean;
};

type FallbackReason = "free_plan" | "no_api_key" | "cap_hit" | undefined;

function fallbackBanner(reason: FallbackReason): { title: string; body: string; variant: "info" | "warning" } | null {
  switch (reason) {
    case "free_plan":
      return {
        title: "Heuristic — upgrade to Pro for AI-personalized output",
        body: "Your plan uses deterministic templates. Pro plans use Claude Haiku (~₹0.05/call, cached forever per plot+client combo).",
        variant: "info",
      };
    case "cap_hit":
      return {
        title: "Monthly AI budget reached",
        body: "Falling back to the deterministic template. Increase your cap in settings or wait for the next billing cycle.",
        variant: "warning",
      };
    case "no_api_key":
      return {
        title: "AI unavailable",
        body: "Set ANTHROPIC_API_KEY in the deploy to enable AI-personalized output.",
        variant: "info",
      };
    default:
      return null;
  }
}

type Valuation = {
  askingInr: number | null;
  valuation: {
    estimatedInr: number;
    lowEnd: number;
    highEnd: number;
    confidence: "low" | "medium" | "high";
    pricePerSqftInr: number | null;
    premiumFactors: string[];
    discountFactors: string[];
    reasoning: string;
    askingVsEstimate: "above" | "below" | "within" | "no-asking-price";
    cacheHit: boolean;
    isFallback: boolean;
    fallbackReason?: FallbackReason;
  };
};

const inr = (n: number) => `₹${n.toLocaleString("en-IN")}`;
const inrShort = (n: number) =>
  n >= 1_00_00_000
    ? `₹${(n / 1_00_00_000).toFixed(2)} Cr`
    : n >= 1_00_000
      ? `₹${(n / 1_00_000).toFixed(1)} L`
      : inr(n);

export function CopilotPanel({ plotId }: { plotId: string }) {
  return (
    <section aria-labelledby="copilot-heading" className="space-y-4">
      <header className="flex items-baseline justify-between gap-3">
        <h2 id="copilot-heading" className="text-lg font-semibold flex items-center gap-2">
          <span aria-hidden>✨</span>
          AI Co-Pilot
        </h2>
        <span className="text-xs text-gray-500">
          Auto-runs against every client + market signal for this plot.
        </span>
      </header>

      <MatchRadar plotId={plotId} />
      <Valuation plotId={plotId} />
    </section>
  );
}

// ─── Match Radar ──────────────────────────────────────────────────────────────

function MatchRadar({ plotId }: { plotId: string }) {
  const [state, setState] = useState<
    | { kind: "idle" }
    | { kind: "loading" }
    | { kind: "ready"; matches: Match[]; ruledOutCount: number; totalScored: number }
    | { kind: "error"; message: string }
  >({ kind: "idle" });

  useEffect(() => {
    let cancelled = false;
    setState({ kind: "loading" });
    fetch(`/api/plots/${plotId}/matches`)
      .then(async (res) => {
        if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || `HTTP ${res.status}`);
        return res.json();
      })
      .then((data) => {
        if (cancelled) return;
        setState({
          kind: "ready",
          matches: data.matches,
          ruledOutCount: data.ruledOutCount ?? 0,
          totalScored: data.totalScored ?? 0,
        });
      })
      .catch((e) => !cancelled && setState({ kind: "error", message: e.message }));
    return () => {
      cancelled = true;
    };
  }, [plotId]);

  return (
    <TkxCard variant="elevated" padding="md">
      <TkxCardHeader
        title="🎯 Match Radar"
        subtitle="Clients in your org scored by fit, ranked by score."
      />
      <TkxCardBody>
        {state.kind === "loading" && (
          <div className="text-sm text-gray-500">Scoring clients…</div>
        )}
        {state.kind === "error" && (
          <TkxAlert variant="danger" title="Couldn't score clients">
            {state.message}
          </TkxAlert>
        )}
        {state.kind === "ready" && state.matches.length === 0 && (
          <TkxAlert variant="info" title="No matches">
            {state.ruledOutCount > 0
              ? `${state.ruledOutCount} client${state.ruledOutCount === 1 ? "" : "s"} ruled out for being well over budget.`
              : "No clients in your org yet. Invite some or add their preferences."}
          </TkxAlert>
        )}
        {state.kind === "ready" && state.matches.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs text-gray-500">
              {state.matches.length} of {state.totalScored} client
              {state.totalScored === 1 ? "" : "s"} match.{" "}
              {state.ruledOutCount > 0 && `(${state.ruledOutCount} ruled out for budget.)`}
            </p>
            {state.matches.slice(0, 5).map((m) => (
              <MatchRow key={m.clientId} match={m} plotId={plotId} />
            ))}
          </div>
        )}
      </TkxCardBody>
    </TkxCard>
  );
}

function MatchRow({ match, plotId }: { match: Match; plotId: string }) {
  const [expanded, setExpanded] = useState(false);
  const [pitch, setPitch] = useState<
    | { kind: "idle" }
    | { kind: "loading" }
    | { kind: "ready"; text: string; waMeUrl: string; cacheHit: boolean; isFallback: boolean; fallbackReason: FallbackReason }
    | { kind: "error"; m: string }
  >({ kind: "idle" });

  const tone = match.score >= 75 ? "success" : match.score >= 50 ? "primary" : "warning";

  async function generatePitch() {
    setPitch({ kind: "loading" });
    try {
      const res = await fetch(`/api/plots/${plotId}/pitch`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ clientId: match.clientId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
      setPitch({
        kind: "ready",
        text: json.text,
        waMeUrl: json.waMeUrl,
        cacheHit: !!json.cacheHit,
        isFallback: !!json.isFallback,
        fallbackReason: json.fallbackReason,
      });
    } catch (e: any) {
      setPitch({ kind: "error", m: e.message });
    }
  }

  return (
    <div className="border rounded-md p-3 bg-white">
      <button
        type="button"
        onClick={() => setExpanded((s) => !s)}
        aria-expanded={expanded}
        className="w-full flex items-center justify-between gap-3 text-left"
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="font-medium truncate">{match.clientName}</span>
            <TkxBadge variant={tone as any}>{match.score}/100</TkxBadge>
          </div>
          <div className="text-xs text-gray-500 truncate">{match.preferencesSummary}</div>
        </div>
        <span className="text-gray-400 text-sm" aria-hidden>
          {expanded ? "▾" : "▸"}
        </span>
      </button>

      {expanded && (
        <div className="mt-3 pt-3 border-t space-y-3">
          <table className="w-full text-xs">
            <tbody>
              {match.breakdown.map((b) => (
                <tr key={b.dimension} className="border-b last:border-b-0">
                  <td className="py-1 pr-2 font-medium capitalize w-24">{b.dimension}</td>
                  <td className="py-1 pr-2 text-gray-600">{b.note}</td>
                  <td className="py-1 text-right tabular-nums text-gray-500">
                    {b.points}/{b.weight}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="flex justify-end gap-2 items-center flex-wrap">
            {pitch.kind === "idle" && (
              <TkxButton type="button" variant="outline" size="sm" onClick={generatePitch}>
                ✨ Generate WhatsApp pitch
              </TkxButton>
            )}
            {pitch.kind === "loading" && (
              <TkxButton type="button" variant="outline" size="sm" disabled isLoading loadingText="Generating…">
                Generating…
              </TkxButton>
            )}
            {pitch.kind === "error" && (
              <TkxAlert variant="danger" title="Pitch failed">
                {pitch.m}
              </TkxAlert>
            )}
            {pitch.kind === "ready" && (
              <div className="w-full space-y-2">
                {pitch.isFallback && (() => {
                  const b = fallbackBanner(pitch.fallbackReason);
                  return b ? (
                    <TkxAlert variant={b.variant} title={b.title}>
                      {b.body}
                    </TkxAlert>
                  ) : null;
                })()}
                <p className="text-sm whitespace-pre-wrap bg-gray-50 border rounded p-3">
                  {pitch.text}
                </p>
                <div className="flex justify-between items-center gap-2">
                  <span className="text-xs text-gray-400">
                    {pitch.cacheHit
                      ? "Served from cache · no LLM cost"
                      : pitch.isFallback
                        ? "Template · no LLM cost"
                        : "Fresh LLM call · cached for 30 days"}
                  </span>
                  <div className="flex gap-2">
                    <TkxButton
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => navigator.clipboard.writeText(pitch.text)}
                    >
                      Copy
                    </TkxButton>
                    <a href={pitch.waMeUrl} target="_blank" rel="noopener noreferrer">
                      <TkxButton type="button" variant="solid" colorScheme="success" size="sm">
                        Open WhatsApp →
                      </TkxButton>
                    </a>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Valuation ────────────────────────────────────────────────────────────────

function Valuation({ plotId }: { plotId: string }) {
  const [state, setState] = useState<
    | { kind: "idle" }
    | { kind: "loading" }
    | { kind: "ready"; data: Valuation }
    | { kind: "error"; m: string }
  >({ kind: "idle" });

  useEffect(() => {
    let cancelled = false;
    setState({ kind: "loading" });
    fetch(`/api/plots/${plotId}/valuation`)
      .then(async (res) => {
        if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || `HTTP ${res.status}`);
        return res.json();
      })
      .then((data) => !cancelled && setState({ kind: "ready", data }))
      .catch((e) => !cancelled && setState({ kind: "error", m: e.message }));
    return () => {
      cancelled = true;
    };
  }, [plotId]);

  return (
    <TkxCard variant="elevated" padding="md">
      <TkxCardHeader
        title="💰 AI Valuation"
        subtitle="Independent estimate of fair-market value with reasoning."
      />
      <TkxCardBody>
        {state.kind === "loading" && (
          <div className="text-sm text-gray-500">Estimating value…</div>
        )}
        {state.kind === "error" && (
          <TkxAlert variant="danger" title="Couldn't compute valuation">
            {state.m}
          </TkxAlert>
        )}
        {state.kind === "ready" && (
          <ValuationView data={state.data} />
        )}
      </TkxCardBody>
    </TkxCard>
  );
}

function ValuationView({ data }: { data: Valuation }) {
  const v = data.valuation;
  const confTone =
    v.confidence === "high" ? "success" : v.confidence === "medium" ? "primary" : "warning";
  const askingTone =
    v.askingVsEstimate === "within"
      ? "success"
      : v.askingVsEstimate === "above"
        ? "warning"
        : v.askingVsEstimate === "below"
          ? "primary"
          : "default";

  return (
    <div className="space-y-4 text-sm">
      <div className="flex items-baseline justify-between gap-3 flex-wrap">
        <div>
          <div className="text-2xl font-bold tabular-nums">{inrShort(v.estimatedInr)}</div>
          <div className="text-xs text-gray-500">
            Range: {inrShort(v.lowEnd)} – {inrShort(v.highEnd)}
            {v.pricePerSqftInr ? ` · ${inr(v.pricePerSqftInr)}/sqft` : ""}
          </div>
        </div>
        <div className="flex flex-col gap-1 items-end">
          <TkxBadge variant={confTone as any}>{v.confidence} confidence</TkxBadge>
          {data.askingInr != null && (
            <TkxBadge variant={askingTone as any}>
              Asking {inrShort(data.askingInr)} — {v.askingVsEstimate}
            </TkxBadge>
          )}
        </div>
      </div>

      <p className="text-gray-700">{v.reasoning}</p>

      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <div className="text-xs font-semibold uppercase text-emerald-700 mb-1">
            Premium factors
          </div>
          {v.premiumFactors.length === 0 ? (
            <div className="text-xs text-gray-400">None identified.</div>
          ) : (
            <ul className="text-xs space-y-0.5 list-disc pl-4">
              {v.premiumFactors.map((f, i) => (
                <li key={i}>{f}</li>
              ))}
            </ul>
          )}
        </div>
        <div>
          <div className="text-xs font-semibold uppercase text-amber-700 mb-1">
            Discount factors
          </div>
          {v.discountFactors.length === 0 ? (
            <div className="text-xs text-gray-400">None identified.</div>
          ) : (
            <ul className="text-xs space-y-0.5 list-disc pl-4">
              {v.discountFactors.map((f, i) => (
                <li key={i}>{f}</li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {v.isFallback && (() => {
        const b = fallbackBanner(v.fallbackReason);
        return b ? (
          <TkxAlert variant={b.variant} title={b.title}>
            {b.body}
          </TkxAlert>
        ) : null;
      })()}

      <div className="text-xs text-gray-400">
        {v.cacheHit
          ? "Served from cache · no LLM cost"
          : v.isFallback
            ? "Heuristic estimate · no LLM cost"
            : "Fresh LLM call · cached for 60 days"}
      </div>
    </div>
  );
}
