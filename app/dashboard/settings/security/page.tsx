import Link from "next/link";
import { requireUser, BROKER_ROLES } from "@/lib/auth/session";
import { TotpEnrollment } from "@/components/security/totp-enrollment";

/**
 * 2FA management. Uses Supabase Auth's MFA API which supports TOTP factors
 * (Google Authenticator, Authy, 1Password, etc.). Multiple factors per user
 * supported. AAL2 (assurance level 2) is required after enrollment.
 *
 * Server component renders the page shell; the client component talks to
 * Supabase Auth directly.
 */
export default async function SecurityPage() {
  const user = await requireUser([...BROKER_ROLES, "super_admin", "client"]);

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <Link href="/dashboard/settings" className="text-sm text-gray-500 hover:underline">
          ← Back to settings
        </Link>
        <h1 className="text-2xl font-bold mt-1">Security</h1>
        <p className="text-gray-500 text-sm mt-1">
          Add a second factor to your account. Required for users who handle paying customers'
          data; recommended for everyone.
        </p>
      </div>

      <section className="bg-white border rounded-lg p-6">
        <h2 className="font-semibold mb-3">Two-factor authentication (TOTP)</h2>
        <p className="text-sm text-gray-600 mb-4">
          Use an authenticator app — Google Authenticator, Authy, 1Password, Bitwarden, or your
          password manager of choice. Scan the QR code with the app, then confirm the 6-digit code.
        </p>
        <TotpEnrollment />
      </section>

      <section className="bg-gray-50 border rounded-lg p-4 text-xs text-gray-600 space-y-1">
        <div className="font-semibold text-gray-700">How this works</div>
        <ul className="list-disc pl-5 space-y-1">
          <li>2FA is enforced by <strong>Supabase Auth</strong> (the same system that holds your password).</li>
          <li>Once enrolled, your next login asks for the code from your authenticator app.</li>
          <li>You can enroll multiple devices. Removing the last factor disables 2FA.</li>
          <li>Lost your phone? Contact the org admin to remove your factor from the Supabase dashboard.</li>
        </ul>
      </section>
    </div>
  );
}
