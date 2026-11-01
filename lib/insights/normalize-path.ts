/**
 * Reduce a URL to a dashboard section before storing it. Record ids and query
 * strings are dropped, so a usage row says "opened a client page", never which
 * client. Returns null for anything outside the dashboard.
 */
export function normalizeDashboardPath(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const path = raw.split(/[?#]/)[0];
  if (path !== "/dashboard" && !path.startsWith("/dashboard/")) return null;
  const normalized = path
    .split("/")
    .map((segment) => (/^[a-z0-9]{20,}$/i.test(segment) ? "[id]" : segment))
    .join("/");
  return normalized.slice(0, 120);
}
