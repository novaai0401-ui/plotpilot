import { prisma } from "@/lib/db/prisma";
import { DeeplinkProvider } from "./deeplink-provider";
import { BusinessApiProvider } from "./business-api-provider";
import type { WhatsAppProvider } from "./types";
import { decryptString, looksEncrypted } from "@/lib/crypto/encrypt";
import { planCaps } from "@/lib/plans";

export type WhatsAppPreference = "auto" | "deeplink" | "business_api";

/**
 * Resolve the WhatsApp provider for an org.
 * - org.whatsappMode = 'deeplink'      → always DeeplinkProvider
 * - org.whatsappMode = 'business_api'  → BusinessApiProvider (or fallback to deeplink if creds missing)
 * - org.whatsappMode = 'hybrid'        → caller's `preference` decides (defaults to deeplink)
 *
 * Retroactive plan-downgrade gating: if the org's CURRENT plan doesn't include
 * `whatsappBusinessApi`, we silently degrade to DeeplinkProvider regardless of
 * the mode setting. Prevents API calls failing at the wire after a downgrade and
 * keeps the broker's bill clean.
 */
export async function resolveWhatsAppProvider(
  orgId: string,
  preference: WhatsAppPreference = "auto"
): Promise<WhatsAppProvider> {
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    include: { whatsappConfig: true },
  });
  if (!org) throw new Error("Org not found");

  const planCapabilities = planCaps(org.plan);

  const wantApi =
    (org.whatsappMode === "business_api" ||
      (org.whatsappMode === "hybrid" && preference === "business_api")) &&
    // Plan must currently include Business API. Otherwise degrade to deeplink.
    planCapabilities.whatsappBusinessApi;

  if (wantApi) {
    const phoneNumberId =
      org.whatsappConfig?.phoneNumberId || process.env.WHATSAPP_DEFAULT_PHONE_NUMBER_ID;
    let accessToken =
      org.whatsappConfig?.accessToken || process.env.WHATSAPP_DEFAULT_ACCESS_TOKEN;
    // Decrypt stored token (gracefully accept legacy plaintext rows)
    if (accessToken && looksEncrypted(accessToken)) {
      try {
        accessToken = decryptString(accessToken);
      } catch (e) {
        console.error(`[whatsapp] failed to decrypt token for org ${orgId}`, e);
        accessToken = undefined as any;
      }
    }
    if (phoneNumberId && accessToken) {
      return new BusinessApiProvider({ phoneNumberId, accessToken });
    }
    // Misconfigured — degrade gracefully to deeplink rather than throwing
    console.warn(`[whatsapp] org ${orgId} requested business_api but creds missing; falling back to deeplink`);
  }

  return new DeeplinkProvider();
}

/**
 * Render a template like "Hi {name}, your visit is at {time}" with context vars.
 */
export function renderTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? `{${k}}`);
}

export { buildWaMeUrl } from "./deeplink-provider";
export * from "./types";
