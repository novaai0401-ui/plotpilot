import Link from "next/link";
import { requireUser } from "@/lib/auth/session";
import { SignOutButton } from "@/components/sign-out-button";
import { LocalePicker } from "@/components/i18n/locale-picker";
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
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="font-bold text-brand">PlotBroker</div>
          <nav className="flex gap-4 text-sm">
            {NAV.map((n) => (
              <Link key={n.href} href={n.href} className="hover:text-brand">
                {t(n.labelKey)}
              </Link>
            ))}
            <SignOutButton />
          </nav>
        </div>
        <div className="max-w-4xl mx-auto px-4 pb-2 text-xs text-gray-500 flex items-center justify-between gap-2">
          <span>{t("public.portal.welcome", { name: user.name })}</span>
          <LocalePicker current={locale} />
        </div>
      </header>
      <main className="max-w-4xl mx-auto px-4 py-6">{children}</main>
    </div>
  );
}
