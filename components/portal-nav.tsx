"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/** Client portal menu. Scrolls sideways on phones so labels stay on one line. */
export function PortalNav({ items }: { items: Array<{ href: string; label: string }> }) {
  const pathname = usePathname();

  return (
    <nav className="max-w-4xl mx-auto px-2 pb-2 flex gap-1 overflow-x-auto text-sm">
      {items.map((n) => {
        const isActive =
          n.href === "/portal"
            ? pathname === "/portal"
            : pathname === n.href || pathname.startsWith(n.href + "/");

        return (
          <Link
            key={n.href}
            href={n.href}
            aria-current={isActive ? "page" : undefined}
            className={
              "shrink-0 whitespace-nowrap px-3 py-2 rounded transition-colors " +
              (isActive ? "bg-brand/10 text-brand font-medium" : "text-gray-700 hover:bg-gray-100")
            }
          >
            {n.label}
          </Link>
        );
      })}
    </nav>
  );
}
