/**
 * Catalogue of known `AnalyticsEvent.type` values we emit anywhere in the app.
 * Used by the audit-log UI to render the type filter dropdown.
 *
 * IMPORTANT: keep in sync. Whenever you call `prisma.analyticsEvent.create()`
 * with a new `type`, add the literal here too. Unknown types still display fine
 * (they fall through to the "all" filter), but they won't appear in the dropdown.
 */

import { translate } from "@/lib/i18n/dict";

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
  "visit.interested",
  "visit.not_interested",
  "visit.booked",
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
 * Label + display group for each event type. `label` and `group` are English;
 * screens should translate `labelKey` and `groupKey` instead. Keep labels short:
 * they render in table rows. The group is used to render a grouped dropdown.
 */
export type EventLabel = {
  label: string;
  group: string;
  emoji: string;
  labelKey: string;
  groupKey: string;
};

function event(type: string, group: string, emoji: string): EventLabel {
  const labelKey = `account.event.${type}`;
  const groupKey = `account.eventGroup.${group}`;
  return {
    label: translate(labelKey, "en"),
    group: translate(groupKey, "en"),
    emoji,
    labelKey,
    groupKey,
  };
}

export const EVENT_LABELS: Record<string, EventLabel> = {
  "org.created": event("org.created", "org", "🏢"),
  "org.demo_seeded": event("org.demo_seeded", "org", "🌱"),
  "invitation.sent": event("invitation.sent", "clients", "📨"),
  "invitation.accepted": event("invitation.accepted", "clients", "✓"),
  "visit.scheduled": event("visit.scheduled", "visits", "📅"),
  "visit.completed": event("visit.completed", "visits", "✓"),
  "visit.cancelled": event("visit.cancelled", "visits", "✕"),
  "visit.no_show": event("visit.no_show", "visits", "—"),
  "visit.interested": event("visit.interested", "visits", "👍"),
  "visit.not_interested": event("visit.not_interested", "visits", "👎"),
  "visit.booked": event("visit.booked", "visits", "🎉"),
  "plot.created": event("plot.created", "plots", "🏞"),
  "message.sent": event("message.sent", "messages", "💬"),
  "message.delivered": event("message.delivered", "messages", "✓"),
  "message.read": event("message.read", "messages", "👁"),
  "message.failed": event("message.failed", "messages", "✕"),
  "message.received": event("message.received", "messages", "↩"),
  "design.generated": event("design.generated", "designs", "🏗"),
  "lead.claimed": event("lead.claimed", "leads", "✊"),
  "team.invite.sent": event("team.invite.sent", "team", "📨"),
  "team.invite.accepted": event("team.invite.accepted", "team", "✓"),
  "billing.subscription.activated": event("billing.subscription.activated", "billing", "💳"),
  "billing.subscription.charged": event("billing.subscription.charged", "billing", "💳"),
  "billing.subscription.resumed": event("billing.subscription.resumed", "billing", "▶"),
  "billing.cancelled": event("billing.cancelled", "billing", "✕"),
  "billing.subscription.halted": event("billing.subscription.halted", "billing", "⚠"),
  "billing.subscription.paused": event("billing.subscription.paused", "billing", "⏸"),
  "data.exported": event("data.exported", "compliance", "📥"),
  "rate_limit.denied": event("rate_limit.denied", "other", "⛔"),
};

export function labelForEvent(type: string): EventLabel {
  // An unknown type has no dictionary entry, so translating labelKey shows the type itself.
  return (
    EVENT_LABELS[type] || {
      label: type,
      group: "Other",
      emoji: "•",
      labelKey: type,
      groupKey: "account.eventGroup.other",
    }
  );
}
