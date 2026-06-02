export type WhatsAppSendInput = {
  to: string;           // E.164 phone, e.g. +919876543210
  body: string;         // already-rendered message text
  context?: Record<string, string>;
};

export type WhatsAppSendResult =
  | { kind: "deeplink"; url: string }                            // open in new tab
  | { kind: "api"; messageId: string; status: "queued" | "sent" }
  | { kind: "error"; error: string };

export interface WhatsAppProvider {
  readonly name: "deeplink" | "business_api";
  send(input: WhatsAppSendInput): Promise<WhatsAppSendResult>;
}
