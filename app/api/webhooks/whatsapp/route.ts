import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

export const dynamic = "force-dynamic";

/**
 * Meta WhatsApp Cloud API webhook.
 *
 * GET  — verification handshake. Meta sends ?hub.mode=subscribe&hub.verify_token=...&hub.challenge=...
 *        We echo `hub.challenge` if the verify token matches WHATSAPP_VERIFY_TOKEN.
 *
 * POST — status & inbound message events. We update Message.status from delivery/read
 *        receipts (matched by `externalRef` = Meta message id) and emit analytics events.
 *
 * NOTE: For per-org webhooks, the same endpoint serves all tenants — Meta does NOT include
 * orgId, so we look up Message rows by externalRef alone. (Message IDs are globally unique.)
 *
 * For production, add HMAC signature validation using your App Secret:
 *   X-Hub-Signature-256: sha256=<hex(hmac(appSecret, rawBody))>
 */

export async function GET(req: NextRequest) {
  const mode = req.nextUrl.searchParams.get("hub.mode");
  const token = req.nextUrl.searchParams.get("hub.verify_token");
  const challenge = req.nextUrl.searchParams.get("hub.challenge");
  if (mode === "subscribe" && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    return new NextResponse(challenge || "", { status: 200 });
  }
  return NextResponse.json({ error: "verify failed" }, { status: 403 });
}

type StatusEntry = {
  id: string;
  status: "sent" | "delivered" | "read" | "failed";
  timestamp: string;
  errors?: Array<{ code: number; title: string; message?: string }>;
};

export async function POST(req: NextRequest) {
  let payload: any;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid json" }, { status: 400 });
  }

  // Meta payload shape: { entry: [ { changes: [ { value: { statuses: [...], messages: [...] } } ] } ] }
  const entries = Array.isArray(payload?.entry) ? payload.entry : [];
  let updated = 0;

  for (const entry of entries) {
    const changes = entry?.changes || [];
    for (const ch of changes) {
      const statuses: StatusEntry[] = ch?.value?.statuses || [];
      for (const s of statuses) {
        const msg = await prisma.message.findFirst({ where: { externalRef: s.id } });
        if (!msg) continue;
        const newStatus =
          s.status === "failed"
            ? "failed"
            : s.status === "read"
            ? "read"
            : s.status === "delivered"
            ? "delivered"
            : "sent";
        await prisma.message.update({
          where: { id: msg.id },
          data: {
            status: newStatus as any,
            errorMessage: s.errors?.[0]?.message || s.errors?.[0]?.title || null,
          },
        });
        await prisma.analyticsEvent.create({
          data: {
            orgId: msg.orgId,
            type: `message.${newStatus}`,
            metadata: { messageId: msg.id, externalRef: s.id },
          },
        });
        updated++;
      }

      // Inbound messages (client replies). Surface as inapp Message rows so brokers see them.
      const incoming = ch?.value?.messages || [];
      for (const m of incoming) {
        const from = String(m.from || "").replace(/[^\d]/g, "");
        if (!from) continue;
        const fromPhone = `+${from}`;
        // Find the client across all orgs by phone (phones are unique per org; clients are typically in one)
        const client = await prisma.user.findFirst({
          where: { phone: fromPhone, role: "client" },
          include: { ownerAgent: true },
        });
        if (!client || !client.ownerAgent) continue;

        const body =
          m.text?.body ||
          (m.type ? `[${m.type} message — open WhatsApp to view]` : "[unknown message]");

        await prisma.message.create({
          data: {
            orgId: client.orgId,
            senderId: client.id,
            recipientId: client.ownerAgent.id,
            channel: "whatsapp_api",
            body,
            externalRef: m.id || null,
            status: "delivered",
            sentAt: new Date(),
          },
        });
        await prisma.analyticsEvent.create({
          data: {
            orgId: client.orgId,
            type: "message.received",
            actorId: client.id,
            metadata: { externalRef: m.id },
          },
        });
      }
    }
  }

  return NextResponse.json({ ok: true, updated });
}
