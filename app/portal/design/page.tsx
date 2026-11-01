import { requireUser } from "@/lib/auth/session";
import { RequirementsWizard } from "@/components/architect/requirements-wizard";
import { t } from "@/lib/i18n/server";

export default async function ClientDesignPage() {
  await requireUser(["client"]);
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{t("design.wizard.title")}</h1>
      <p className="text-sm text-gray-500">
        {t("design.portal.subtitle")}
      </p>
      <RequirementsWizard source="client" />
    </div>
  );
}
