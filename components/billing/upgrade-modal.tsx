"use client";
import { useEffect, useState } from "react";
import { TkxModal, TkxButton, TkxBadge, TkxAlert, useToast } from "@/components/tkx-dyn";
import { PLAN_CAPABILITIES } from "@/lib/plans";

export type CapInfo = {
  reason: string;
  currentPlan: "free" | "pro" | "enterprise";
  currentPlanLabel: string;
  suggestUpgradeTo: "pro" | "enterprise" | null;
  used: number;
  limit: number;
};

declare global {
  interface Window {
    Razorpay?: any;
  }
}

/**
 * Modal shown when the user hits a plan cap (or voluntarily upgrades).
 * Uses TkxModal (portal-rendered) + TkxButton for the CTAs, with toast
 * notifications instead of inline error text for transient errors.
 */
export function UpgradeModal({
  open,
  onClose,
  cap,
}: {
  open: boolean;
  onClose: () => void;
  cap: CapInfo | null;
}) {
  const [busy, setBusy] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (!open) return;
    if (typeof window === "undefined" || window.Razorpay) return;
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.async = true;
    document.body.appendChild(s);
  }, [open]);

  if (!cap) return null;
  const target = cap.suggestUpgradeTo;
  const targetCaps = target ? PLAN_CAPABILITIES[target] : null;

  async function onUpgrade(plan: "pro" | "enterprise") {
    setBusy(true);
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Checkout failed");

      for (let i = 0; i < 30 && !window.Razorpay; i++) {
        await new Promise((r) => setTimeout(r, 100));
      }
      if (!window.Razorpay) throw new Error("Razorpay script failed to load");

      const rzp = new window.Razorpay({
        key: j.keyId,
        subscription_id: j.subscriptionId,
        name: "PlotBroker",
        description: `${plan === "pro" ? "Pro" : "Enterprise"} subscription`,
        handler: () => {
          toast({
            title: "Payment received",
            description: "Your plan will activate in a few seconds.",
            variant: "success",
          });
          onClose();
          setTimeout(() => window.location.reload(), 1500);
        },
        modal: { ondismiss: () => setBusy(false) },
        theme: { color: "#0f766e" },
      });
      rzp.open();
    } catch (e: any) {
      toast({ title: "Couldn't start checkout", description: e.message, variant: "danger" });
      setBusy(false);
    }
  }

  return (
    <TkxModal
      isOpen={open}
      onClose={onClose}
      title={`${cap.currentPlanLabel} plan limit reached`}
      size="md"
      footer={
        <div style={{ display: "flex", justifyContent: "space-between", gap: 8, width: "100%" }}>
          <TkxButton variant="ghost" onClick={onClose}>
            Not now
          </TkxButton>
          {target && (
            <TkxButton
              variant="solid"
              colorScheme="primary"
              isLoading={busy}
              loadingText="Opening checkout…"
              onClick={() => onUpgrade(target)}
            >
              Upgrade to {targetCaps?.label}
            </TkxButton>
          )}
        </div>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <TkxAlert variant="warning" title="Usage cap hit">
          You've used <strong>{cap.used} of {cap.limit}</strong> designs this month on your {cap.currentPlanLabel} plan.
          {target ? " Upgrade to keep building." : " You're already on the highest tier — contact us for custom limits."}
        </TkxAlert>

        {targetCaps && target && (
          <div
            style={{
              border: "2px solid #0f766e",
              borderRadius: 8,
              padding: 16,
              background: "rgba(20,184,166,0.06)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <div>
                <TkxBadge variant="primary" size="sm">Recommended</TkxBadge>
                <div style={{ fontSize: 18, fontWeight: 700, marginTop: 6 }}>{targetCaps.label}</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 24, fontWeight: 700 }}>
                  ₹{targetCaps.priceInr.toLocaleString("en-IN")}
                </div>
                <div style={{ fontSize: 12, color: "#6b7280" }}>per month</div>
              </div>
            </div>
            <ul
              style={{
                marginTop: 12,
                paddingLeft: 0,
                listStyle: "none",
                display: "flex",
                flexDirection: "column",
                gap: 4,
              }}
            >
              <Feature>
                Up to <strong>{targetCaps.monthlyDesignsCap.toLocaleString()}</strong> designs/month
              </Feature>
              <Feature>
                <strong>{targetCaps.monthlyLeadAlertsCap.toLocaleString()}</strong> lead alerts/month
              </Feature>
              {targetCaps.llmNarrative && <Feature>AI-generated design narratives</Feature>}
              {targetCaps.aiRender && <Feature>AI concept renders</Feature>}
              {targetCaps.whatsappBusinessApi && <Feature>WhatsApp Business API (automated sends)</Feature>}
            </ul>
          </div>
        )}

        {target === "pro" && (
          <button
            onClick={() => onUpgrade("enterprise")}
            disabled={busy}
            style={{
              background: "none",
              border: "none",
              color: "#6b7280",
              textDecoration: "underline",
              cursor: "pointer",
              padding: 0,
              fontSize: 13,
            }}
          >
            Or jump straight to Enterprise (₹{PLAN_CAPABILITIES.enterprise.priceInr.toLocaleString("en-IN")}/mo)
          </button>
        )}
      </div>
    </TkxModal>
  );
}

function Feature({ children }: { children: React.ReactNode }) {
  return (
    <li style={{ display: "flex", alignItems: "baseline", gap: 6, fontSize: 14, color: "#374151" }}>
      <span style={{ color: "#0f766e", fontWeight: 700 }}>✓</span>
      <span>{children}</span>
    </li>
  );
}
