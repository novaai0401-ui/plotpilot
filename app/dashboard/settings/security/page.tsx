import Link from "next/link";
import { requireUser, BROKER_ROLES } from "@/lib/auth/session";
import { t } from "@/lib/i18n/server";

/**
 * 2FA management. Login already verifies TOTP (lib/auth/native), but enrolment
 * was built on Supabase Auth, which the app no longer uses, and rendering it
 * crashed the page. Until native enrolment exists this page says so plainly.
 */
export default async function SecurityPage() {
  await requireUser([...BROKER_ROLES, "super_admin", "client"]);

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <Link href="/dashboard/settings" className="text-sm text-gray-500 hover:underline">
          {t("account.backToSettings")}
        </Link>
        <h1 className="text-2xl font-bold mt-1">{t("account.security.title")}</h1>
        <p className="text-gray-500 text-sm mt-1">{t("account.security.intro")}</p>
      </div>

      <section className="bg-white border rounded-lg p-6">
        <h2 className="font-semibold mb-3">{t("account.security.totpTitle")}</h2>
        <p className="text-sm text-gray-600">{t("common.twoFactorUnavailable")}</p>
      </section>
    </div>
  );
}
