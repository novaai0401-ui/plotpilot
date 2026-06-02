import { prisma } from "@/lib/db/prisma";
import { resolveWhatsAppProvider, WhatsAppPreference } from "./index";
import type { MessageChannel, MessageStatus } from "@prisma/client";

export type SendAndLogParams = {
  orgId: string;
  senderId: string;
  recipientId: string;
  recipientPhone: string;
  body: string;
  visitId?: string;
  preference?: WhatsAppPreference;
};

export type SendAndLogResult =
  | { ok: true; messageId: string; openUrl?: string }
  | { ok: false; error: string };

/**
 * Single entry point for "broker sends WhatsApp message to client":
 * resolves provider, sends, logs Message row + analytics event.
 * For deeplink mode returns `openUrl` so the UI opens it in a new tab.
 */
export async function sendAndLogWhatsApp(p: SendAndLogParams): Promise<SendAndLogResult> {
  const provider = await resolveWhatsAppProvider(p.orgId, p.preference);
  const result = await provider.send({ to: p.recipientPhone, body: p.body });

  let channel: MessageChannel;
  let status: MessageStatus;
  let externalRef: string | null = null;
  let openUrl: string | undefined;
  let errorMessage: string | null = null;

  if (result.kind === "deeplink") {
    channel = "whatsapp_deeplink";
    status = "queued"; // not actually sent until user clicks send in WhatsApp
    externalRef = result.url;
    openUrl = result.url;
  } else if (result.kind === "api") {
    channel = "whatsapp_api";
    status = "sent";
    externalRef = result.messageId;
  } else {
    channel = "whatsapp_api";
    status = "failed";
    errorMessage = result.error;
  }

  const msg = await prisma.message.create({
    data: {
      orgId: p.orgId,
      senderId: p.senderId,
      recipientId: p.recipientId,
      visitId: p.visitId,
      channel,
      body: p.body,
      externalRef,
      status,
      errorMessage,
      sentAt: status === "sent" || status === "queued" ? new Date() : null,
    },
  });

  await prisma.analyticsEvent.create({
    data: {
      orgId: p.orgId,
      type: status === "failed" ? "message.failed" : "message.sent",
      actorId: p.senderId,
      metadata: { messageId: msg.id, channel, visitId: p.visitId ?? null },
    },
  });

  if (status === "failed") return { ok: false, error: errorMessage || "Unknown error" };
  return { ok: true, messageId: msg.id, openUrl };
}
