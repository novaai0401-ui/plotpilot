import { headers } from "next/headers";

/**
 * Base URL for links a signed-in broker copies or shares: the configured public
 * URL, else the address they are using now. Host headers are caller-controlled,
 * so anything emailed to an unauthenticated visitor must not use this.
 */
export function appUrl(): string {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL;
  const h = headers();
  return `${h.get("x-forwarded-proto") || "http"}://${h.get("host")}`;
}
