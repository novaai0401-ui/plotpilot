import { Suspense } from "react";
import { t } from "@/lib/i18n/server";
import { LoginInner } from "./login-inner";

/**
 * Server wrapper:
 *  - Reads the locale cookie via the i18n server helper
 *  - Resolves the strings client-component needs and passes them as props
 *  - Wraps in <Suspense> so useSearchParams() in the inner client doesn't break
 *    static prerendering at build time.
 *
 * The inner component stays client-only (needs useRouter / useSearchParams /
 * useState). No client-side dictionary lookup → no hydration mismatch risk.
 */
export default function LoginPage() {
  const strings = {
    title: t("login.title"),
    subtitle: t("login.subtitle"),
    email: t("login.email"),
    password: t("login.password"),
    signIn: t("login.signIn"),
    signingIn: t("login.signingIn"),
    noOrg: t("login.noOrg"),
    startFree: t("login.startFree"),
  };
  return (
    <Suspense>
      <LoginInner strings={strings} />
    </Suspense>
  );
}
