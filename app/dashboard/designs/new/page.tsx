import { requireUser, BROKER_ROLES } from "@/lib/auth/session";
import { RequirementsWizard } from "@/components/architect/requirements-wizard";
import { t } from "@/lib/i18n/server";

export default async function NewDesignPage() {
  await requireUser(BROKER_ROLES);
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{t("design.new.title")}</h1>
      <p className="text-sm text-gray-500">
        {t("design.new.subtitle")}
      </p>
      <RequirementsWizard source="standalone" />
    </div>
  );
}
