"use client";

import { useEffect, useState } from "react";
import { csrfFetch } from "@/lib/security/csrf-fetch";
import {
  TkxAlert,
  TkxBadge,
  TkxButton,
  TkxCard,
  TkxCardBody,
  TkxCardHeader,
} from "@/components/tkx-dyn";
import { useLocale, useT } from "@/lib/i18n/client";
import { formatInr } from "@/lib/i18n/format";

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

function fallbackBanner(reason: FallbackReason, t: ReturnType<typeof useT>): { title: string; body: string; variant: "info" | "warning" } | null {
  switch (reason) {
    case "free_plan":
      return {
        title: t("broker.copilot.fallback.freeTitle"),
        body: t("broker.copilot.fallback.freeBody"),
        variant: "info",
      };
    case "cap_hit":
      return {
        title: t("broker.copilot.fallback.capTitle"),
        body: t("broker.copilot.fallback.capBody"),
        variant: "warning",
      };
    case "no_api_key":
      return {
        title: t("broker.copilot.fallback.noKeyTitle"),
        body: t("broker.copilot.fallback.noKeyBody"),
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

export function CopilotPanel({ plotId }: { plotId: string }) {
  const t = useT();
  return (
    <section aria-labelledby="copilot-heading" className="space-y-4">
      <header className="flex items-baseline justify-between gap-3">
        <h2 id="copilot-heading" className="text-lg font-semibold flex items-center gap-2">
          <span aria-hidden>✨</span>
          {t("broker.copilot.title")}
        </h2>
        <span className="text-xs text-gray-500">
          {t("broker.copilot.tagline")}
        </span>
      </header>

      <MatchRadar plotId={plotId} />
      <Valuation plotId={plotId} />
    </section>
  );
}

// ─── Match Radar ──────────────────────────────────────────────────────────────

function MatchRadar({ plotId }: { plotId: string }) {
  const t = useT();
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
        title={`🎯 ${t("broker.copilot.radar.title")}`}
        subtitle={t("broker.copilot.radar.subtitle")}
      />
      <TkxCardBody>
        {state.kind === "loading" && (
          <div className="text-sm text-gray-500">{t("broker.copilot.radar.scoring")}</div>
        )}
        {state.kind === "error" && (
          <TkxAlert variant="danger" title={t("broker.copilot.radar.failed")}>
            {state.message}
          </TkxAlert>
        )}
        {state.kind === "ready" && state.matches.length === 0 && (
          <TkxAlert variant="info" title={t("broker.copilot.radar.noMatches")}>
            {state.ruledOutCount > 0
              ? t(state.ruledOutCount === 1 ? "broker.copilot.radar.ruledOutOne" : "broker.copilot.radar.ruledOutMany", {
                  count: state.ruledOutCount,
                })
              : t("broker.copilot.radar.noClients")}
          </TkxAlert>
        )}
        {state.kind === "ready" && state.matches.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs text-gray-500">
              {t(state.totalScored === 1 ? "broker.copilot.radar.matchCountOne" : "broker.copilot.radar.matchCountMany", {
                matched: state.matches.length,
                total: state.totalScored,
              })}{" "}
              {state.ruledOutCount > 0 && t("broker.copilot.radar.ruledOutShort", { count: state.ruledOutCount })}
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
  const t = useT();
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
      const res = await csrfFetch(`/api/plots/${plotId}/pitch`, {
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
                  <td className="py-1 pr-2 font-medium capitalize w-24">{t(`broker.copilot.dimension.${b.dimension}`)}</td>
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
                ✨ {t("broker.copilot.pitch.generate")}
              </TkxButton>
            )}
            {pitch.kind === "loading" && (
              <TkxButton type="button" variant="outline" size="sm" disabled isLoading loadingText={t("broker.copilot.pitch.generating")}>
                {t("broker.copilot.pitch.generating")}
              </TkxButton>
            )}
            {pitch.kind === "error" && (
              <TkxAlert variant="danger" title={t("broker.copilot.pitch.failed")}>
                {pitch.m}
              </TkxAlert>
            )}
            {pitch.kind === "ready" && (
              <div className="w-full space-y-2">
                {pitch.isFallback && (() => {
                  const b = fallbackBanner(pitch.fallbackReason, t);
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
                      ? t("broker.copilot.cost.cached")
                      : pitch.isFallback
                        ? t("broker.copilot.cost.template")
                        : t("broker.copilot.cost.fresh", { days: 30 })}
                  </span>
                  <div className="flex gap-2">
                    <TkxButton
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => navigator.clipboard.writeText(pitch.text)}
                    >
                      {t("broker.copilot.pitch.copy")}
                    </TkxButton>
                    <a href={pitch.waMeUrl} target="_blank" rel="noopener noreferrer">
                      <TkxButton type="button" variant="solid" colorScheme="success" size="sm">
                        {t("broker.openWhatsApp")} →
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
  const t = useT();
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
        title={`💰 ${t("broker.copilot.valuation.title")}`}
        subtitle={t("broker.copilot.valuation.subtitle")}
      />
      <TkxCardBody>
        {state.kind === "loading" && (
          <div className="text-sm text-gray-500">{t("broker.copilot.valuation.estimating")}</div>
        )}
        {state.kind === "error" && (
          <TkxAlert variant="danger" title={t("broker.copilot.valuation.failed")}>
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
  const t = useT();
  const locale = useLocale();
  const inrShort = (n: number) =>
    n >= 1_00_00_000
      ? t("broker.copilot.valuation.crore", { amount: (n / 1_00_00_000).toFixed(2) })
      : n >= 1_00_000
        ? t("broker.copilot.valuation.lakh", { amount: (n / 1_00_000).toFixed(1) })
        : formatInr(n, locale);
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
            {t("broker.copilot.valuation.range", { low: inrShort(v.lowEnd), high: inrShort(v.highEnd) })}
            {v.pricePerSqftInr
              ? ` · ${t("broker.copilot.valuation.perSqft", { price: formatInr(v.pricePerSqftInr, locale) })}`
              : ""}
          </div>
        </div>
        <div className="flex flex-col gap-1 items-end">
          <TkxBadge variant={confTone as any}>{t(`broker.copilot.valuation.confidence.${v.confidence}`)}</TkxBadge>
          {data.askingInr != null && (
            <TkxBadge variant={askingTone as any}>
              {t("broker.copilot.valuation.asking", {
                amount: inrShort(data.askingInr),
                position: t(`broker.copilot.valuation.position.${v.askingVsEstimate}`),
              })}
            </TkxBadge>
          )}
        </div>
      </div>

      <p className="text-gray-700">{v.reasoning}</p>

      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <div className="text-xs font-semibold uppercase text-emerald-700 mb-1">
            {t("broker.copilot.valuation.premiumFactors")}
          </div>
          {v.premiumFactors.length === 0 ? (
            <div className="text-xs text-gray-400">{t("broker.copilot.valuation.noneIdentified")}</div>
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
            {t("broker.copilot.valuation.discountFactors")}
          </div>
          {v.discountFactors.length === 0 ? (
            <div className="text-xs text-gray-400">{t("broker.copilot.valuation.noneIdentified")}</div>
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
        const b = fallbackBanner(v.fallbackReason, t);
        return b ? (
          <TkxAlert variant={b.variant} title={b.title}>
            {b.body}
          </TkxAlert>
        ) : null;
      })()}

      <div className="text-xs text-gray-400">
        {v.cacheHit
          ? t("broker.copilot.cost.cached")
          : v.isFallback
            ? t("broker.copilot.cost.heuristic")
            : t("broker.copilot.cost.fresh", { days: 60 })}
      </div>
    </div>
  );
}
