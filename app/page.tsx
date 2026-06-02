import Link from "next/link";
import { t, getLocale } from "@/lib/i18n/server";
import { LocalePicker } from "@/components/i18n/locale-picker";

export default function HomePage() {
  const locale = getLocale();
  const features = [
    { t: t("landing.feature.invite.title"), d: t("landing.feature.invite.desc") },
    { t: t("landing.feature.schedule.title"), d: t("landing.feature.schedule.desc") },
    { t: t("landing.feature.whatsapp.title"), d: t("landing.feature.whatsapp.desc") },
  ];

  return (
    <main className="min-h-screen bg-gradient-to-b from-white to-teal-50">
      <header className="px-6 py-4 flex items-center justify-between max-w-6xl mx-auto">
        <div className="font-bold text-xl text-brand">PlotBroker</div>
        <nav className="flex items-center gap-4 text-sm">
          <LocalePicker current={locale} />
          <Link href="/login" className="hover:text-brand">{t("landing.cta.login")}</Link>
          <Link href="/signup" className="px-3 py-1.5 bg-brand text-white rounded-md hover:bg-brand-dark">
            {t("landing.cta.startFree")}
          </Link>
        </nav>
      </header>

      <section className="max-w-4xl mx-auto px-6 py-20 text-center">
        <h1 className="text-5xl font-bold tracking-tight text-gray-900">
          {t("landing.headline")}
        </h1>
        <p className="mt-6 text-lg text-gray-600 max-w-2xl mx-auto">
          {t("landing.subhead")}
        </p>
        <div className="mt-10 flex gap-4 justify-center flex-wrap">
          <Link
            href="/signup"
            className="px-6 py-3 bg-brand text-white rounded-md hover:bg-brand-dark font-medium"
          >
            {t("landing.cta.startFree")}
          </Link>
          <Link
            href="/design"
            className="px-6 py-3 bg-amber-500 text-white rounded-md hover:bg-amber-600 font-medium"
          >
            {t("landing.cta.tryArchitect")}
          </Link>
          <Link
            href="/login"
            className="px-6 py-3 border border-gray-300 rounded-md hover:bg-gray-50 font-medium"
          >
            {t("landing.cta.login")}
          </Link>
        </div>
      </section>

      <section className="max-w-5xl mx-auto px-6 py-12 grid md:grid-cols-3 gap-6">
        {features.map((f) => (
          <div key={f.t} className="p-6 bg-white border rounded-lg shadow-sm">
            <h3 className="font-semibold text-lg text-gray-900">{f.t}</h3>
            <p className="mt-2 text-gray-600 text-sm">{f.d}</p>
          </div>
        ))}
      </section>

      <footer className="text-center text-xs text-gray-500 py-10">
        &copy; {new Date().getFullYear()} PlotBroker. All rights reserved.
      </footer>
    </main>
  );
}
