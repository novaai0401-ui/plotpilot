import { t } from "@/lib/i18n/server";

export default function Forbidden() {
  return (
    <main className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-3xl font-bold">{t("public.forbidden.title")}</h1>
        <p className="text-gray-500 mt-2">{t("public.forbidden.body")}</p>
      </div>
    </main>
  );
}
