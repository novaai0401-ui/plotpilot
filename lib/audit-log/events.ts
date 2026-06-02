/**
 * Catalogue of known `AnalyticsEvent.type` values we emit anywhere in the app.
 * Used by the audit-log UI to render the type filter dropdown.
 *
 * IMPORTANT: keep in sync. Whenever you call `prisma.analyticsEvent.create()`
 * with a new `type`, add the literal here too. Unknown types still display fine
 * (they fall through to the "all" filter), but they won't appear in the dropdown.
 */

export const KNOWN_EVENT_TYPES = [
  // Org lifecycle
  "org.created",
  // Invitations (client)
  "invitation.sent",
  "invitation.accepted",
  // Visits
  "visit.scheduled",
  "visit.completed",
  "visit.cancelled",
  "visit.no_show",
  // Plots
  "plot.created",
  // Messages
  "message.sent",
  "message.delivered",
  "message.read",
  "message.failed",
  "message.received",
  // Designs (architect)
  "design.generated",
  // Public leads
  "lead.claimed",
  // Team
  "team.invite.sent",
  "team.invite.accepted",
  // Billing
  "billing.subscription.activated",
  "billing.subscription.charged",
  "billing.subscription.resumed",
  "billing.cancelled",
  "billing.subscription.halted",
  "billing.subscription.paused",
  // Data export
  "data.exported",
] as const;

export type KnownEventType = (typeof KNOWN_EVENT_TYPES)[number];

/**
 * Human label + display group for each event type. Keep "label" short — these
 * render in table rows. The "group" is used to render a grouped dropdown.
 */
export const EVENT_LABELS: Record<string, { label: string; group: string; emoji: string }> = {
  "org.created": { label: "Org created", group: "Org", emoji: "🏢" },
  "invitation.sent": { label: "Client invited", group: "Clients", emoji: "📨" },
  "invitation.accepted": { label: "Client joined", group: "Clients", emoji: "✓" },
  "visit.scheduled": { label: "Visit scheduled", group: "Visits", emoji: "📅" },
  "visit.completed": { label: "Visit completed", group: "Visits", emoji: "✓" },
  "visit.cancelled": { label: "Visit cancelled", group: "Visits", emoji: "✕" },
  "visit.no_show": { label: "Visit no-show", group: "Visits", emoji: "—" },
  "plot.created": { label: "Plot added", group: "Plots", emoji: "🏞" },
  "message.sent": { label: "Message sent", group: "Messages", emoji: "💬" },
  "message.delivered": { label: "Message delivered", group: "Messages", emoji: "✓" },
  "message.read": { label: "Message read", group: "Messages", emoji: "👁" },
  "message.failed": { label: "Message failed", group: "Messages", emoji: "✕" },
  "message.received": { label: "Message received", group: "Messages", emoji: "↩" },
  "design.generated": { label: "Design generated", group: "Designs", emoji: "🏗" },
  "lead.claimed": { label: "Lead claimed", group: "Leads", emoji: "✊" },
  "team.invite.sent": { label: "Team invite sent", group: "Team", emoji: "📨" },
  "team.invite.accepted": { label: "Team joined", group: "Team", emoji: "✓" },
  "billing.subscription.activated": { label: "Subscription activated", group: "Billing", emoji: "💳" },
  "billing.subscription.charged": { label: "Subscription renewed", group: "Billing", emoji: "💳" },
  "billing.subscription.resumed": { label: "Subscription resumed", group: "Billing", emoji: "▶" },
  "billing.cancelled": { label: "Subscription cancelled", group: "Billing", emoji: "✕" },
  "billing.subscription.halted": { label: "Subscription halted", group: "Billing", emoji: "⚠" },
  "billing.subscription.paused": { label: "Subscription paused", group: "Billing", emoji: "⏸" },
  "data.exported": { label: "Data exported", group: "Compliance", emoji: "📥" },
};

export function labelForEvent(type: string): { label: string; group: string; emoji: string } {
  return EVENT_LABELS[type] || { label: type, group: "Other", emoji: "•" };
}
