"use client";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { TkxCard, TkxCardBody, TkxBadge, TkxButton, TkxEmpty, useToast } from "@/components/tkx-dyn";

export type InboxRow = {
  id: string;
  title: string;
  body: string;
  link: string | null;
  type: string;
  readAt: string | null;
  createdAt: string;
};

export function InboxList({ items, unreadCount }: { items: InboxRow[]; unreadCount: number }) {
  const router = useRouter();
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);

  async function markAllRead() {
    setBusy(true);
    const res = await fetch("/api/notifications/mark-all-read", { method: "POST" });
    setBusy(false);
    if (!res.ok) {
      toast({ title: "Could not mark as read", variant: "danger" });
      return;
    }
    toast({ title: `${unreadCount} marked as read`, variant: "success" });
    router.refresh();
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 800 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>Inbox</h1>
          {unreadCount > 0 && (
            <TkxBadge variant="primary" size="md" pulse>
              {unreadCount}
            </TkxBadge>
          )}
        </div>
        {unreadCount > 0 && (
          <TkxButton variant="ghost" size="sm" colorScheme="primary" isLoading={busy} onClick={markAllRead}>
            Mark all read
          </TkxButton>
        )}
      </div>

      {items.length === 0 ? (
        <TkxCard variant="outlined" padding="lg">
          <TkxEmpty image="simple" description="No notifications yet — we'll let you know when leads come in." />
        </TkxCard>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {items.map((n) => (
            <NotificationCard key={n.id} n={n} />
          ))}
        </div>
      )}
    </div>
  );
}

function NotificationCard({ n }: { n: InboxRow }) {
  const unread = !n.readAt;
  return (
    <Link href={n.link || "#"} style={{ textDecoration: "none", color: "inherit" }}>
      <TkxCard
        variant={unread ? "elevated" : "outlined"}
        padding="md"
        isHoverable
        isClickable
        style={unread ? { borderLeft: "3px solid #0f766e" } : undefined}
      >
        <TkxCardBody>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                {unread && <TkxBadge variant="primary" size="sm" dot />}
                <strong style={{ fontSize: 14 }}>{n.title}</strong>
                <BadgeForType type={n.type} />
              </div>
              <div style={{ fontSize: 13, color: "#4b5563" }}>{n.body}</div>
            </div>
            <div style={{ fontSize: 11, color: "#9ca3af", whiteSpace: "nowrap" }}>{timeAgo(n.createdAt)}</div>
          </div>
        </TkxCardBody>
      </TkxCard>
    </Link>
  );
}

function BadgeForType({ type }: { type: string }) {
  const map: Record<string, { label: string; variant: "primary" | "success" | "warning" | "info" | "danger" | "default" }> = {
    public_lead: { label: "lead", variant: "info" },
    lead_claimed: { label: "claimed", variant: "success" },
    visit_scheduled: { label: "visit", variant: "primary" },
    visit_reminder: { label: "reminder", variant: "warning" },
    system_message: { label: "system", variant: "default" },
  };
  const m = map[type] || { label: type, variant: "default" as const };
  return (
    <TkxBadge variant={m.variant} size="sm" outlined>
      {m.label}
    </TkxBadge>
  );
}

function timeAgo(iso: string): string {
  const d = new Date(iso);
  const seconds = Math.floor((Date.now() - d.getTime()) / 1000);
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
  if (seconds < 7 * 86400) return `${Math.floor(seconds / 86400)}d`;
  return d.toLocaleDateString();
}
