import type { WhatsAppProvider, WhatsAppSendInput, WhatsAppSendResult } from "./types";

/**
 * Generates a wa.me deep link. The UI opens the URL in a new tab; user must hit Send in WhatsApp.
 * No API cost, no Meta approval required.
 */
export class DeeplinkProvider implements WhatsAppProvider {
  readonly name = "deeplink" as const;

  async send(input: WhatsAppSendInput): Promise<WhatsAppSendResult> {
    const phone = input.to.replace(/[^\d]/g, ""); // wa.me wants digits only
    const url = `https://wa.me/${phone}?text=${encodeURIComponent(input.body)}`;
    return { kind: "deeplink", url };
  }
}

export function buildWaMeUrl(to: string, body: string): string {
  const phone = to.replace(/[^\d]/g, "");
  return `https://wa.me/${phone}?text=${encodeURIComponent(body)}`;
}
