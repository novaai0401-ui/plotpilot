"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  TkxAlert,
  TkxButton,
  TkxCard,
  TkxCardBody,
  TkxCardHeader,
  TkxInput,
} from "@/components/tkx-dyn";

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
  const [confirmSlug, setConfirmSlug] = useState("");
  const [acknowledged, setAcknowledged] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const slugMatches = confirmSlug.trim() === orgSlug;
  const canDelete = slugMatches && acknowledged && !submitting;

  async function onDelete() {
    if (!canDelete) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/account/delete", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ confirmSlug }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError(j.error || `Deletion failed (HTTP ${res.status})`);
        setSubmitting(false);
        return;
      }
      // Server already signed us out + the org row is gone. Hard-navigate to /signup
      // (not router.push) so any cached layouts / RSC payloads referencing the dead
      // org are evicted.
      window.location.href = "/signup";
    } catch (e: any) {
      setError(e?.message || "Network error");
      setSubmitting(false);
    }
  }

  return (
    <TkxCard variant="outlined" padding="lg">
      <TkxCardHeader
        title="Delete organization and all data"
        subtitle="Permanently removes your brokerage, every team member's access, and all client/plot/visit/design records."
      />
      <TkxCardBody>
        <div className="space-y-5">
          <TkxAlert variant="danger" title="This cannot be undone">
            <div className="space-y-2 text-sm">
              <p>
                Deletion erases <strong>{orgName}</strong> and everything attached to it:
              </p>
              <ul className="list-disc pl-5 space-y-0.5">
                <li>
                  <strong>{counts.users}</strong> user account{counts.users === 1 ? "" : "s"} (you
                  and every team member)
                </li>
                <li>
                  <strong>{counts.plots}</strong> plot listing{counts.plots === 1 ? "" : "s"}
                </li>
                <li>
                  <strong>{counts.visits}</strong> visit record{counts.visits === 1 ? "" : "s"}
                </li>
                <li>
                  <strong>{counts.designs}</strong> AI-generated design{counts.designs === 1 ? "" : "s"}
                </li>
                <li>All messages, notifications, invitations, and analytics history</li>
              </ul>
              <p className="text-xs">
                If you need a copy of any of this, cancel and run{" "}
                <a
                  href="/dashboard/settings/data-export"
                  className="text-brand font-medium underline"
                >
                  data export
                </a>{" "}
                first.
              </p>
            </div>
          </TkxAlert>

          <div>
            <TkxInput
              label="Type the organization slug to confirm"
              hint={`Slug: ${orgSlug}`}
              value={confirmSlug}
              onChange={(e) => setConfirmSlug(e.target.value)}
              placeholder={orgSlug}
              autoComplete="off"
              spellCheck={false}
              isInvalid={confirmSlug.length > 0 && !slugMatches}
              error={
                confirmSlug.length > 0 && !slugMatches
                  ? "Doesn't match the slug shown."
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
            <span>
              I understand this is permanent and cannot be reversed by support. I have already
              exported any data I want to keep.
            </span>
          </label>

          {error && (
            <TkxAlert variant="danger" title="Deletion failed">
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
              loadingText="Deleting…"
              aria-describedby={canDelete ? undefined : "danger-zone-requirements"}
            >
              Delete {orgName} forever
            </TkxButton>
            {!canDelete && (
              <p
                id="danger-zone-requirements"
                className="text-xs text-gray-500"
              >
                {!slugMatches
                  ? "Enter the exact slug above to enable deletion."
                  : "Tick the acknowledgement to enable deletion."}
              </p>
            )}
          </div>
        </div>
      </TkxCardBody>
    </TkxCard>
  );
}
