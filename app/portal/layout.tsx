import { requireUser } from "@/lib/auth/session";
import { SignOutButton } from "@/components/sign-out-button";
import { LocalePicker } from "@/components/i18n/locale-picker";
import { PortalNav } from "@/components/portal-nav";
import { t, getLocale } from "@/lib/i18n/server";

const NAV = [
  { href: "/portal", labelKey: "public.portal.nav.home" },
  { href: "/portal/visits", labelKey: "public.portal.nav.visits" },
  { href: "/portal/messages", labelKey: "nav.messages" },
  { href: "/portal/design", labelKey: "public.portal.nav.design" },
  { href: "/portal/profile", labelKey: "public.portal.nav.profile" },
];

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser(["client"]);
  const locale = getLocale();
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="font-bold text-brand">PlotBroker</div>
            <div className="text-xs text-gray-500 truncate">
              {t("public.portal.welcome", { name: user.name })}
            </div>
          </div>
          <div className="shrink-0 flex items-center gap-3 text-sm">
            <LocalePicker current={locale} />
            <SignOutButton />
          </div>
        </div>
        <PortalNav items={NAV.map((n) => ({ href: n.href, label: t(n.labelKey) }))} />
      </header>
      <main className="max-w-4xl mx-auto px-4 py-6">{children}</main>
    </div>
  );
}
