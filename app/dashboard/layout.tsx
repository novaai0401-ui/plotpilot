import { requireUser, BROKER_ROLES } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { SignOutButton } from "@/components/sign-out-button";
import { t, getLocale } from "@/lib/i18n/server";
import { LocalePicker } from "@/components/i18n/locale-picker";
import { ThemePicker } from "@/components/theme-picker";
import { getThemeMode } from "@/lib/theme";
import { DashboardNav, type DashboardNavItem } from "@/components/dashboard-nav";

/**
 * Sidebar nav. Labels come from the i18n dictionary; `i18nKey` is the dict key,
 * resolved per-request via the locale cookie. To add a new nav item:
 *   1. Add a `nav.foo` entry to `lib/i18n/dict.ts`
 *   2. Add `{ href, i18nKey: "nav.foo" }` here
 */
const NAV: Array<{ href: string; i18nKey: string; isInbox?: boolean }> = [
  { href: "/dashboard", i18nKey: "nav.overview" },
  { href: "/dashboard/inbox", i18nKey: "nav.inbox", isInbox: true },
  { href: "/dashboard/clients", i18nKey: "nav.clients" },
  { href: "/dashboard/plots", i18nKey: "nav.plots" },
  { href: "/dashboard/invitations", i18nKey: "nav.invitations" },
  { href: "/dashboard/visits", i18nKey: "nav.visits" },
  { href: "/dashboard/messages", i18nKey: "nav.messages" },
  { href: "/dashboard/designs", i18nKey: "nav.designs" },
  { href: "/dashboard/analytics", i18nKey: "nav.analytics" },
  { href: "/dashboard/audit-log", i18nKey: "nav.auditLog" },
  { href: "/dashboard/team", i18nKey: "nav.team" },
  { href: "/dashboard/usage", i18nKey: "nav.usage" },
  { href: "/dashboard/settings", i18nKey: "nav.settings" },
];

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser(BROKER_ROLES);
  const [org, unreadCount] = await Promise.all([
    prisma.organization.findUnique({ where: { id: user.orgId } }),
    prisma.notification.count({ where: { userId: user.id, readAt: null } }),
  ]);
  const locale = getLocale();
  const themeMode = getThemeMode();

  // Resolve i18n strings server-side so the client nav doesn't need the dict.
  const navItems: DashboardNavItem[] = NAV.map((n) => ({
    href: n.href,
    label: t(n.i18nKey),
    isInbox: n.isInbox,
  }));

  return (
    <div className="min-h-screen flex bg-gray-50">
      <aside
        className="w-60 bg-white border-r flex flex-col"
        aria-label="Dashboard sidebar"
      >
        <div className="p-4 border-b">
          <div className="text-xs uppercase text-gray-400">Organization</div>
          <div className="font-semibold truncate">{org?.name}</div>
        </div>

        <DashboardNav items={navItems} unreadCount={unreadCount} />

        <section
          className="p-3 border-t text-xs space-y-2"
          aria-label="Account and preferences"
        >
          <div className="font-medium">{user.name}</div>
          <div className="text-gray-500">{user.role}</div>
          <div className="flex items-center justify-between pt-1 gap-2">
            <LocalePicker current={locale} />
            <ThemePicker current={themeMode} />
          </div>
          <div className="pt-1">
            <SignOutButton />
          </div>
        </section>
      </aside>
      <main className="flex-1 p-6 overflow-y-auto">{children}</main>
    </div>
  );
}
