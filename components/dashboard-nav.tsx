"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { TkxBadge } from "@/components/tkx-dyn";

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

  return (
    <nav className="p-2 flex-1 space-y-1 text-sm" aria-label="Dashboard navigation">
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
              "flex items-center justify-between px-3 py-2 rounded transition-colors " +
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
