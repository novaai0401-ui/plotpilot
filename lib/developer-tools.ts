/**
 * Developer-facing screens (OAuth apps, authorized apps, WhatsApp API setup) are
 * for the team integrating the product, not for brokers. They stay hidden unless
 * NEXT_PUBLIC_SHOW_DEVELOPER_TOOLS=true at build time. The code and the /api/v1
 * routes are unaffected.
 */
export function developerToolsEnabled(): boolean {
  return process.env.NEXT_PUBLIC_SHOW_DEVELOPER_TOOLS === "true";
}
