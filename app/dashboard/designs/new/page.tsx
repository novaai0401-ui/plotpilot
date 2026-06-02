import { requireUser, BROKER_ROLES } from "@/lib/auth/session";
import { RequirementsWizard } from "@/components/architect/requirements-wizard";

export default async function NewDesignPage() {
  await requireUser(BROKER_ROLES);
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">New building design</h1>
      <p className="text-sm text-gray-500">
        Walk through requirements — we'll generate a floor plan, design brief, and concept render.
      </p>
      <RequirementsWizard source="standalone" />
    </div>
  );
}
