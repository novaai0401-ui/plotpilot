import type { WhatsAppProvider, WhatsAppSendInput, WhatsAppSendResult } from "./types";

export type BusinessApiCreds = {
  phoneNumberId: string;
  accessToken: string;
};

/**
 * Sends via Meta WhatsApp Business Cloud API.
 * Per-org creds are loaded from WhatsAppConfig; fallback to env defaults for testing.
 */
export class BusinessApiProvider implements WhatsAppProvider {
  readonly name = "business_api" as const;
  constructor(private creds: BusinessApiCreds) {}

  async send(input: WhatsAppSendInput): Promise<WhatsAppSendResult> {
    const url = `https://graph.facebook.com/v20.0/${this.creds.phoneNumberId}/messages`;
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.creds.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: input.to.replace(/[^\d]/g, ""),
          type: "text",
          text: { body: input.body },
        }),
      });

      if (!res.ok) {
        const txt = await res.text();
        return { kind: "error", error: `Meta API ${res.status}: ${txt}` };
      }

      const json = (await res.json()) as { messages?: { id: string }[] };
      const messageId = json.messages?.[0]?.id ?? "unknown";
      return { kind: "api", messageId, status: "sent" };
    } catch (e: any) {
      return { kind: "error", error: e?.message || String(e) };
    }
  }
}
