"use client";
import { useState } from "react";
import { csrfFetch } from "@/lib/security/csrf-fetch";
import { useRouter } from "next/navigation";
import { TkxButton, TkxBadge, useToast } from "@/components/tkx-dyn";
import { UpgradeModal, type CapInfo } from "./upgrade-modal";
import type { OrgPlan } from "@prisma/client";
import { useLocale, useT } from "@/lib/i18n/client";
import { formatDate } from "@/lib/i18n/format";

export function ManageSubscription({
  plan,
  subscriptionStatus,
  usedDesigns,
  designsCap,
  currentPlanLabel,
}: {
  plan: OrgPlan;
  subscriptionStatus: string | null;
  usedDesigns: number;
  designsCap: number;
  currentPlanLabel: string;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const t = useT();
  const locale = useLocale();
  const [capInfo, setCapInfo] = useState<CapInfo | null>(null);
  const [busy, setBusy] = useState(false);

  function openUpgrade(target: "pro" | "enterprise") {
    setCapInfo({
      reason: "voluntary_upgrade",
      currentPlan: plan,
      currentPlanLabel,
      suggestUpgradeTo: target,
      used: usedDesigns,
      limit: designsCap,
    });
  }

  async function onCancel() {
    if (!confirm(t("account.billing.cancelConfirm"))) return;
    setBusy(true);
    const res = await csrfFetch("/api/billing/cancel", { method: "POST" });
    const j = await res.json();
    setBusy(false);
    if (!res.ok) {
      const description = res.status === 503 ? t("account.billing.unavailable") : j.error || t("account.billing.tryLater");
      toast({ title: t("account.billing.cancelFailed"), description, variant: "danger" });
      return;
    }
    toast({
      title: t("account.billing.cancelled"),
      description: j.willEndAt ? t("account.billing.accessUntil", { date: formatDate(j.willEndAt, locale) }) : undefined,
      variant: "info",
    });
    router.refresh();
  }

  return (
    <>
      <UpgradeModal open={capInfo !== null} onClose={() => setCapInfo(null)} cap={capInfo} />
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
        {plan === "free" && (
          <TkxButton variant="solid" colorScheme="primary" onClick={() => openUpgrade("pro")}>
            {t("account.billing.upgradeTo", { plan: t("account.plan.pro") })}
          </TkxButton>
        )}
        {plan === "pro" && (
          <>
            <TkxButton variant="solid" colorScheme="primary" onClick={() => openUpgrade("enterprise")}>
              {t("account.billing.upgradeTo", { plan: t("account.plan.enterprise") })}
            </TkxButton>
            {subscriptionStatus === "active" && (
              <TkxButton variant="outline" colorScheme="secondary" isLoading={busy} loadingText={t("account.billing.cancelling")} onClick={onCancel}>
                {t("account.billing.cancelSubscription")}
              </TkxButton>
            )}
          </>
        )}
        {plan === "enterprise" && subscriptionStatus === "active" && (
          <TkxButton variant="outline" colorScheme="secondary" isLoading={busy} loadingText={t("account.billing.cancelling")} onClick={onCancel}>
            {t("account.billing.cancelSubscription")}
          </TkxButton>
        )}
        {subscriptionStatus === "cancelled" && (
          <TkxBadge variant="warning" size="md" outlined>
            {t("account.billing.cancelledBadge")}
          </TkxBadge>
        )}
      </div>
    </>
  );
}
