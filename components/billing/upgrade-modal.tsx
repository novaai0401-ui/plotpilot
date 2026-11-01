"use client";
import { useEffect, useState, type ReactNode } from "react";
import { csrfFetch } from "@/lib/security/csrf-fetch";
import { TkxModal, TkxButton, TkxBadge, TkxAlert, useToast } from "@/components/tkx-dyn";
import { useLocale, useT } from "@/lib/i18n/client";
import { formatInr, formatNumber } from "@/lib/i18n/format";
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
  const t = useT();
  const locale = useLocale();

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
  const currentPlanLabel = t(`account.plan.${cap.currentPlan}`);
  const targetPlanLabel = target ? t(`account.plan.${target}`) : "";
  const voluntary = cap.reason === "voluntary_upgrade";

  async function onUpgrade(plan: "pro" | "enterprise") {
    setBusy(true);
    try {
      const res = await csrfFetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });
      const j = await res.json();
      if (res.status === 503) throw new Error(t("account.billing.unavailable"));
      if (!res.ok) throw new Error(j.error || t("account.upgrade.checkoutFailed"));

      for (let i = 0; i < 30 && !window.Razorpay; i++) {
        await new Promise((r) => setTimeout(r, 100));
      }
      if (!window.Razorpay) throw new Error(t("account.upgrade.scriptFailed"));

      const rzp = new window.Razorpay({
        key: j.keyId,
        subscription_id: j.subscriptionId,
        name: "PlotBroker",
        description: t("account.upgrade.subscription", { plan: t(`account.plan.${plan}`) }),
        handler: () => {
          toast({
            title: t("account.upgrade.paymentReceived"),
            description: t("account.upgrade.activating"),
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
      toast({ title: t("account.upgrade.startFailed"), description: e.message, variant: "danger" });
      setBusy(false);
    }
  }

  return (
    <TkxModal
      isOpen={open}
      onClose={onClose}
      title={
        voluntary
          ? t("account.billing.upgradeTo", { plan: targetPlanLabel })
          : t("account.upgrade.limitReached", { plan: currentPlanLabel })
      }
      size="md"
      footer={
        <div style={{ display: "flex", justifyContent: "space-between", gap: 8, width: "100%" }}>
          <TkxButton variant="ghost" onClick={onClose}>
            {t("account.upgrade.notNow")}
          </TkxButton>
          {target && (
            <TkxButton
              variant="solid"
              colorScheme="primary"
              isLoading={busy}
              loadingText={t("account.upgrade.openingCheckout")}
              onClick={() => onUpgrade(target)}
            >
              {t("account.billing.upgradeTo", { plan: targetPlanLabel })}
            </TkxButton>
          )}
        </div>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {!voluntary && (
          <TkxAlert variant="warning" title={t("account.upgrade.capHit")}>
            {withBold(
              t("account.upgrade.used", { plan: currentPlanLabel }),
              t("account.upgrade.usedOfLimit", { used: cap.used, limit: cap.limit })
            )}{" "}
            {t(target ? "account.upgrade.keepBuilding" : "account.upgrade.highestTier")}
          </TkxAlert>
        )}

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
                <TkxBadge variant="primary" size="sm">{t("account.upgrade.recommended")}</TkxBadge>
                <div style={{ fontSize: 18, fontWeight: 700, marginTop: 6 }}>{targetPlanLabel}</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 24, fontWeight: 700 }}>
                  {formatInr(targetCaps.priceInr, locale)}
                </div>
                <div style={{ fontSize: 12, color: "#6b7280" }}>{t("account.upgrade.perMonth")}</div>
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
                {withBold(t("account.upgrade.designsCap"), formatNumber(targetCaps.monthlyDesignsCap, locale))}
              </Feature>
              <Feature>
                {withBold(t("account.upgrade.leadAlertsCap"), formatNumber(targetCaps.monthlyLeadAlertsCap, locale))}
              </Feature>
              {targetCaps.llmNarrative && <Feature>{t("account.upgrade.featureNarrative")}</Feature>}
              {targetCaps.aiRender && <Feature>{t("account.upgrade.featureRender")}</Feature>}
              {targetCaps.whatsappBusinessApi && <Feature>{t("account.upgrade.featureWhatsapp")}</Feature>}
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
            {t("account.upgrade.jumpToEnterprise", {
              price: t("account.billing.perMonth", {
                price: formatInr(PLAN_CAPABILITIES.enterprise.priceInr, locale),
              }),
            })}
          </button>
        )}
      </div>
    </TkxModal>
  );
}

/** Bolds `value` where a translated string has its one remaining {placeholder}. */
function withBold(template: string, value: ReactNode) {
  const [before, after] = template.split(/\{\w+\}/);
  return (
    <>
      {before}
      <strong>{value}</strong>
      {after}
    </>
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
