"use client";

import { useState } from "react";
import { csrfFetch } from "@/lib/security/csrf-fetch";
import { useRouter } from "next/navigation";
import {
  TkxAlert,
  TkxButton,
  TkxCard,
  TkxCardBody,
  TkxCardHeader,
  TkxInput,
} from "@/components/tkx-dyn";
import { useT } from "@/lib/i18n/client";

type Counts = {
  users: number;
  plots: number;
  visits: number;
  designs: number;
};

export function DangerZone({
  orgSlug,
  orgName,
  counts,
}: {
  orgSlug: string;
  orgName: string;
  counts: Counts;
}) {
  const router = useRouter();
  const t = useT();
  const [confirmSlug, setConfirmSlug] = useState("");
  const [acknowledged, setAcknowledged] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const slugMatches = confirmSlug.trim() === orgSlug;
  const canDelete = slugMatches && acknowledged && !submitting;
  const plural = (n: number) => (n === 1 ? "one" : "other");
  const [erasesBefore, erasesAfter] = t("account.danger.erases").split("{org}");
  const [copyBefore, copyAfter] = t("account.danger.copyHint").split("{link}");

  async function onDelete() {
    if (!canDelete) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await csrfFetch("/api/account/delete", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ confirmSlug }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError(j.error || t("account.danger.failedHttp", { status: res.status }));
        setSubmitting(false);
        return;
      }
      // Server already signed us out + the org row is gone. Hard-navigate to /signup
      // (not router.push) so any cached layouts / RSC payloads referencing the dead
      // org are evicted.
      window.location.href = "/signup";
    } catch (e: any) {
      setError(e?.message || t("account.danger.networkError"));
      setSubmitting(false);
    }
  }

  return (
    <TkxCard variant="outlined" padding="lg">
      <TkxCardHeader
        title={t("account.danger.cardTitle")}
        subtitle={t("account.danger.cardSubtitle")}
      />
      <TkxCardBody>
        <div className="space-y-5">
          <TkxAlert variant="danger" title={t("account.danger.cannotUndo")}>
            <div className="space-y-2 text-sm">
              <p>
                {erasesBefore}
                <strong>{orgName}</strong>
                {erasesAfter}
              </p>
              <ul className="list-disc pl-5 space-y-0.5">
                <li>
                  <strong>{counts.users}</strong> {t(`account.danger.users.${plural(counts.users)}`)}
                </li>
                <li>
                  <strong>{counts.plots}</strong> {t(`account.danger.plots.${plural(counts.plots)}`)}
                </li>
                <li>
                  <strong>{counts.visits}</strong> {t(`account.danger.visits.${plural(counts.visits)}`)}
                </li>
                <li>
                  <strong>{counts.designs}</strong> {t(`account.danger.designs.${plural(counts.designs)}`)}
                </li>
                <li>{t("account.danger.rest")}</li>
              </ul>
              <p className="text-xs">
                {copyBefore}
                <a
                  href="/dashboard/settings/data-export"
                  className="text-brand font-medium underline"
                >
                  {t("account.danger.dataExportLink")}
                </a>
                {copyAfter}
              </p>
            </div>
          </TkxAlert>

          <div>
            <TkxInput
              label={t("account.danger.slugLabel")}
              hint={t("account.danger.slugHint", { slug: orgSlug })}
              value={confirmSlug}
              onChange={(e) => setConfirmSlug(e.target.value)}
              placeholder={orgSlug}
              autoComplete="off"
              spellCheck={false}
              isInvalid={confirmSlug.length > 0 && !slugMatches}
              error={
                confirmSlug.length > 0 && !slugMatches
                  ? t("account.danger.slugMismatch")
                  : undefined
              }
            />
          </div>

          <label className="flex items-start gap-2 text-sm text-gray-700">
            <input
              id="danger-zone-ack"
              type="checkbox"
              checked={acknowledged}
              onChange={(e) => setAcknowledged(e.target.checked)}
              className="mt-0.5"
            />
            <span>{t("account.danger.acknowledge")}</span>
          </label>

          {error && (
            <TkxAlert variant="danger" title={t("account.danger.failed")}>
              {error}
            </TkxAlert>
          )}

          <div className="pt-2 border-t flex flex-col items-end gap-1">
            <TkxButton
              variant="solid"
              colorScheme="danger"
              size="lg"
              onClick={onDelete}
              disabled={!canDelete}
              isLoading={submitting}
              loadingText={t("account.danger.deleting")}
              aria-describedby={canDelete ? undefined : "danger-zone-requirements"}
            >
              {t("account.danger.deleteForever", { name: orgName })}
            </TkxButton>
            {!canDelete && (
              <p
                id="danger-zone-requirements"
                className="text-xs text-gray-500"
              >
                {!slugMatches
                  ? t("account.danger.enterSlug")
                  : t("account.danger.tickAck")}
              </p>
            )}
          </div>
        </div>
      </TkxCardBody>
    </TkxCard>
  );
}
