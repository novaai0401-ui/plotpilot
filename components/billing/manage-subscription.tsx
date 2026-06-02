"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { TkxButton, TkxBadge, useToast } from "@/components/tkx-dyn";
import { UpgradeModal, type CapInfo } from "./upgrade-modal";
import type { OrgPlan } from "@prisma/client";

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
    if (!confirm("Cancel subscription? You'll keep access until the end of the current billing period.")) return;
    setBusy(true);
    const res = await fetch("/api/billing/cancel", { method: "POST" });
    const j = await res.json();
    setBusy(false);
    if (!res.ok) {
      toast({ title: "Cancel failed", description: j.error || "Try again later", variant: "danger" });
      return;
    }
    toast({
      title: "Subscription cancelled",
      description: j.willEndAt ? `Access continues until ${new Date(j.willEndAt).toLocaleDateString()}.` : undefined,
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
            Upgrade to Pro
          </TkxButton>
        )}
        {plan === "pro" && (
          <>
            <TkxButton variant="solid" colorScheme="primary" onClick={() => openUpgrade("enterprise")}>
              Upgrade to Enterprise
            </TkxButton>
            {subscriptionStatus === "active" && (
              <TkxButton variant="outline" colorScheme="secondary" isLoading={busy} loadingText="Cancelling…" onClick={onCancel}>
                Cancel subscription
              </TkxButton>
            )}
          </>
        )}
        {plan === "enterprise" && subscriptionStatus === "active" && (
          <TkxButton variant="outline" colorScheme="secondary" isLoading={busy} loadingText="Cancelling…" onClick={onCancel}>
            Cancel subscription
          </TkxButton>
        )}
        {subscriptionStatus === "cancelled" && (
          <TkxBadge variant="warning" size="md" outlined>
            Cancelled — access continues until period ends
          </TkxBadge>
        )}
      </div>
    </>
  );
}
