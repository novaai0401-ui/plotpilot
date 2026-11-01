import Link from "next/link";
import { verifyEmail } from "@/lib/auth/native/service";
import { t } from "@/lib/i18n/server";

/**
 * /auth/verify-email?token=pbev_...
 *
 * Public landing for the verification link sent during signup. Renders a
 * success or failure card. Idempotent — re-clicking a used link surfaces
 * a friendly "already verified" message.
 */
export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: { token?: string };
}) {
  const token = searchParams.token || "";
  const result = token
    ? await verifyEmail(token)
    : { ok: false as const, errorKey: "public.verify.missingToken" };

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md w-full bg-white border rounded-lg p-8 text-center space-y-4">
        <div className="text-5xl" aria-hidden>
          {result.ok ? "✅" : "⚠️"}
        </div>
        <h1 className="text-2xl font-bold text-gray-900">
          {result.ok ? t("public.verify.successTitle") : t("public.verify.failTitle")}
        </h1>
        <p className="text-sm text-gray-600">
          {result.ok ? t("public.verify.successBody") : t(result.errorKey)}
        </p>
        <div className="flex justify-center gap-2 pt-2">
          <Link
            href={result.ok ? "/dashboard" : "/login"}
            className="px-4 py-2 text-sm bg-brand text-white rounded hover:bg-brand-dark"
          >
            {result.ok ? t("public.verify.goToDashboard") : t("public.verify.backToSignIn")}
          </Link>
        </div>
      </div>
    </main>
  );
}
