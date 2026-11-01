import Link from "next/link";
import { RequirementsWizard } from "@/components/architect/requirements-wizard";
import { LocalePicker } from "@/components/i18n/locale-picker";
import { getLocale, t } from "@/lib/i18n/server";

// Public, no-auth lead-gen page
export default function PublicDesignPage() {
  const [footerBefore, footerAfter] = t("design.public.footer").split("{link}");

  return (
    <main className="min-h-screen bg-gradient-to-b from-white to-teal-50">
      <header className="px-6 py-4 flex items-center justify-between max-w-5xl mx-auto">
        <Link href="/" className="font-bold text-xl text-brand">PlotBroker</Link>
        <nav className="flex items-center gap-4 text-sm">
          <LocalePicker current={getLocale()} />
          <Link href="/login" className="hover:text-brand">{t("design.public.brokersLogin")}</Link>
        </nav>
      </header>

      <section className="max-w-3xl mx-auto px-6 py-10 text-center">
        <h1 className="text-4xl font-bold text-gray-900">
          {t("design.public.headline")}
        </h1>
        <p className="mt-4 text-gray-600">
          {t("design.public.subhead")}
        </p>
      </section>

      <section className="max-w-3xl mx-auto px-6 pb-16">
        <RequirementsWizard source="public_lead" />
      </section>

      <footer className="text-center text-xs text-gray-500 py-10">
        {footerBefore}<Link href="/signup" className="text-brand">{t("design.public.footerCta")}</Link>{footerAfter}
      </footer>
    </main>
  );
}
