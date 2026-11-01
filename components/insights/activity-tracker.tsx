"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { csrfFetch } from "@/lib/security/csrf-fetch";

/**
 * Reports dashboard section views. Only rendered when the org has switched
 * staff activity tracking on; the API re-checks that setting regardless.
 */
export function ActivityTracker() {
  const pathname = usePathname();

  useEffect(() => {
    csrfFetch("/api/insights/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: pathname }),
    }).catch(() => {});
  }, [pathname]);

  return null;
}
