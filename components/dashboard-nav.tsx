"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { TkxBadge } from "@/components/tkx-dyn";
import { useT } from "@/lib/i18n/client";

/**
 * Sidebar nav links. Client component because we need usePathname() to
 * highlight the active item — otherwise this could stay a server component.
 *
 * Labels resolved server-side via the i18n dictionary and passed in as
 * pre-rendered strings to keep the locale cookie evaluation on the server.
 */
export type DashboardNavItem = {
  href: string;
  label: string;
  isInbox?: boolean;
};

export function DashboardNav({
  items,
  unreadCount,
}: {
  items: DashboardNavItem[];
  unreadCount: number;
}) {
  const pathname = usePathname();
  const t = useT();

  return (
    <nav
      className="p-2 flex-1 flex gap-1 overflow-x-auto md:flex-col md:gap-0 md:space-y-1 md:overflow-visible text-sm"
      aria-label={t("common.aria.navigation")}
    >
      {items.map((n) => {
        // Active if exact match, or this item is the prefix of the current path
        // (so /dashboard/plots/abc highlights "Plots"). Special-case the root
        // dashboard so it isn't always active.
        const isActive =
          n.href === "/dashboard"
            ? pathname === "/dashboard"
            : pathname === n.href || pathname.startsWith(n.href + "/");

        return (
          <Link
            key={n.href}
            href={n.href}
            aria-current={isActive ? "page" : undefined}
            className={
              "flex shrink-0 items-center justify-between gap-2 px-3 py-2 rounded transition-colors whitespace-nowrap " +
              (isActive
                ? "bg-brand/10 text-brand font-medium"
                : "text-gray-700 hover:bg-gray-100")
            }
          >
            <span>{n.label}</span>
            {n.isInbox && unreadCount > 0 && (
              <TkxBadge variant="primary">{unreadCount}</TkxBadge>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
