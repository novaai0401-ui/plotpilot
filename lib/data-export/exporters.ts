import { prisma } from "@/lib/db/prisma";
import { csvDocument } from "./csv";

/**
 * Per-table CSV exporters. Every exporter:
 *   - Scopes by orgId (mandatory — never leak cross-tenant)
 *   - Selects only fields safe to share with the data owner
 *   - Returns a CSV string with a BOM + RFC 4180 quoting + formula-injection defuse
 *
 * Add new table here, then add the key to `EXPORTERS` at the bottom + a button
 * in the settings UI.
 */

const isoOrEmpty = (d: Date | null | undefined) => (d ? d.toISOString() : "");

export async function exportClients(orgId: string): Promise<string> {
  const rows = await prisma.user.findMany({
    where: { orgId, role: "client" },
    include: { ownerAgent: { select: { name: true, email: true } } },
    orderBy: { createdAt: "asc" },
  });
  return csvDocument(
    ["id", "name", "phone", "email", "owner_agent_name", "owner_agent_email", "created_at"],
    rows.map((r) => [
      r.id,
      r.name,
      r.phone,
      r.email ?? "",
      r.ownerAgent?.name ?? "",
      r.ownerAgent?.email ?? "",
      isoOrEmpty(r.createdAt),
    ])
  );
}

export async function exportPlots(orgId: string): Promise<string> {
  const rows = await prisma.plot.findMany({
    where: { orgId },
    orderBy: { createdAt: "asc" },
  });
  return csvDocument(
    [
      "id",
      "title",
      "location",
      "city",
      "lat",
      "lng",
      "size_sqft",
      "price_inr",
      "status",
      "photo_count",
      "description",
      "created_at",
    ],
    rows.map((r) => [
      r.id,
      r.title,
      r.location,
      r.city ?? "",
      r.lat ?? "",
      r.lng ?? "",
      r.sizeSqft ?? "",
      r.priceInr ?? "",
      r.status,
      r.photos.length,
      r.description ?? "",
      isoOrEmpty(r.createdAt),
    ])
  );
}

export async function exportVisits(orgId: string): Promise<string> {
  const rows = await prisma.visit.findMany({
    where: { orgId },
    include: {
      client: { select: { name: true, phone: true } },
      plot: { select: { title: true } },
      agent: { select: { name: true } },
    },
    orderBy: { scheduledAt: "asc" },
  });
  return csvDocument(
    [
      "id",
      "scheduled_at",
      "status",
      "client_name",
      "client_phone",
      "plot_title",
      "agent_name",
      "rating",
      "notes",
      "feedback",
      "created_at",
    ],
    rows.map((r) => [
      r.id,
      isoOrEmpty(r.scheduledAt),
      r.status,
      r.client.name,
      r.client.phone,
      r.plot.title,
      r.agent.name,
      r.rating ?? "",
      r.notes ?? "",
      r.feedback ?? "",
      isoOrEmpty(r.createdAt),
    ])
  );
}

export async function exportInvitations(orgId: string): Promise<string> {
  const rows = await prisma.invitation.findMany({
    where: { orgId },
    include: { sentBy: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
  });
  return csvDocument(
    [
      "id",
      "client_name",
      "client_phone",
      "client_email",
      "status",
      "sent_by",
      "expires_at",
      "accepted_at",
      "created_at",
    ],
    rows.map((r) => [
      r.id,
      r.clientName ?? "",
      r.clientPhone,
      r.clientEmail ?? "",
      r.status,
      r.sentBy.name,
      isoOrEmpty(r.expiresAt),
      isoOrEmpty(r.acceptedAt),
      isoOrEmpty(r.createdAt),
    ])
  );
}

export async function exportMessages(orgId: string): Promise<string> {
  const rows = await prisma.message.findMany({
    where: { orgId },
    include: {
      sender: { select: { name: true, role: true } },
      recipient: { select: { name: true, role: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 10_000, // safety cap — message history can be huge
  });
  return csvDocument(
    [
      "id",
      "created_at",
      "channel",
      "status",
      "sender",
      "sender_role",
      "recipient",
      "recipient_role",
      "body",
      "external_ref",
    ],
    rows.map((r) => [
      r.id,
      isoOrEmpty(r.createdAt),
      r.channel,
      r.status,
      r.sender.name,
      r.sender.role,
      r.recipient.name,
      r.recipient.role,
      r.body,
      r.externalRef ?? "",
    ])
  );
}

export async function exportDesigns(orgId: string): Promise<string> {
  const rows = await prisma.buildingDesign.findMany({
    where: { orgId },
    include: { plot: { select: { title: true } } },
    orderBy: { createdAt: "desc" },
  });
  return csvDocument(
    [
      "id",
      "created_at",
      "source",
      "status",
      "plot",
      "project_type",
      "total_sqft",
      "floors",
      "lead_name",
      "lead_phone",
      "lead_email",
      "lead_city",
      "llm_cache_hit",
      "render_cache_hit",
      "claimed_at",
    ],
    rows.map((r) => {
      const req = (r.requirements as any) || {};
      return [
        r.id,
        isoOrEmpty(r.createdAt),
        r.source,
        r.status,
        r.plot?.title ?? "",
        req?.projectType ?? "",
        req?.plot?.totalSqft ?? "",
        req?.floors ?? "",
        r.leadName ?? "",
        r.leadPhone ?? "",
        r.leadEmail ?? "",
        r.leadCity ?? "",
        r.llmCacheHit,
        r.renderCacheHit,
        isoOrEmpty(r.claimedAt),
      ];
    })
  );
}

export async function exportUsageEvents(orgId: string): Promise<string> {
  const rows = await prisma.usageEvent.findMany({
    where: { orgId },
    orderBy: { createdAt: "desc" },
    take: 10_000,
  });
  return csvDocument(
    ["id", "created_at", "kind", "units", "cost_usd_micro", "metadata"],
    rows.map((r) => [
      r.id,
      isoOrEmpty(r.createdAt),
      r.kind,
      r.units,
      r.costUsdMicro.toString(),
      r.metadata ? JSON.stringify(r.metadata) : "",
    ])
  );
}

export type ExportTable =
  | "clients"
  | "plots"
  | "visits"
  | "invitations"
  | "messages"
  | "designs"
  | "usage";

export const EXPORTERS: Record<ExportTable, (orgId: string) => Promise<string>> = {
  clients: exportClients,
  plots: exportPlots,
  visits: exportVisits,
  invitations: exportInvitations,
  messages: exportMessages,
  designs: exportDesigns,
  usage: exportUsageEvents,
};

export const EXPORT_LABELS: Record<ExportTable, string> = {
  clients: "Clients",
  plots: "Plots",
  visits: "Visits",
  invitations: "Invitations",
  messages: "Messages",
  designs: "Designs",
  usage: "Usage events",
};
